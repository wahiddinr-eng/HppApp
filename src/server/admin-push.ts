import { createECDH } from "node:crypto";
import { Agent as HttpsAgent } from "node:https";
import { isIP } from "node:net";
import type { PoolClient } from "pg";
import webpush from "web-push";
import { z } from "zod";
import { query, transaction } from "./db";

// The VPS needs more time to connect to Apple's IPv4 edge than Node's
// automatic IPv4/IPv6 attempt window allows. Leave other push hosts unchanged.
const applePushAgent = new HttpsAgent({ family: 4, autoSelectFamily: false });

export function pushAgentForEndpoint(endpoint: string) {
  return new URL(endpoint).hostname === "web.push.apple.com" ? applePushAgent : undefined;
}

const endpointSchema = z.string().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
      !isIP(url.hostname) && url.hostname.includes(".") && !/\.(?:local|internal|localhost)$/i.test(url.hostname);
  } catch { return false; }
}, "Endpoint notifikasi tidak valid.");

export const adminPushSubscriptionSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{20,40}$/),
  }),
});

export function adminPushConfig() {
  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY || "";
  const subject = process.env.PUSH_VAPID_SUBJECT || "";
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(publicKey) || !/^[A-Za-z0-9_-]{40,60}$/.test(privateKey)) return null;
  if (!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject)) {
    try {
      const url = new URL(subject);
      if (url.protocol !== "https:" || url.username || url.password || isIP(url.hostname) ||
        !url.hostname.includes(".") || /\.(?:local|internal|localhost)$/i.test(url.hostname)) return null;
    } catch { return null; }
  }
  try {
    const publicBytes = Buffer.from(publicKey, "base64url");
    const privateBytes = Buffer.from(privateKey, "base64url");
    if (publicBytes.length !== 65 || privateBytes.length !== 32) return null;
    const pair = createECDH("prime256v1");
    pair.setPrivateKey(privateBytes);
    if (!pair.getPublicKey().equals(publicBytes)) return null;
  } catch { return null; }
  return { publicKey, privateKey, subject };
}

export async function enqueueOrderPush(client: PoolClient, orderId: string) {
  if (!adminPushConfig()) return;
  await client.query(`INSERT INTO admin_push_job(order_id,subscription_id)
    SELECT $1,s.id FROM admin_push_subscription s
    JOIN user_profile p ON p.user_id=s.user_id
    WHERE p.role='admin' AND p.account_status='active' AND s.last_seen_at>now()-interval '90 days'
    ON CONFLICT(order_id,subscription_id) DO NOTHING`, [orderId]);
}

export function orderPushPayload(code: string) {
  return JSON.stringify({ type: "new_order", code });
}

export async function processOneAdminPush(): Promise<boolean> {
  const config = adminPushConfig();
  if (!config) return false;
  return transaction(async (client) => {
    const jobs = await client.query<{id:string;endpoint:string;p256dh:string;auth_secret:string;code:string}>(`
      SELECT j.id,s.endpoint,s.p256dh,s.auth_secret,o.code
      FROM admin_push_job j
      JOIN admin_push_subscription s ON s.id=j.subscription_id
      JOIN checkout_order o ON o.id=j.order_id
      JOIN user_profile p ON p.user_id=s.user_id
      WHERE j.status IN ('pending','failed') AND j.next_attempt<=now() AND j.attempts<8
        AND p.role='admin' AND p.account_status='active'
      ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1`);
    const job = jobs.rows[0];
    if (!job) return false;
    try {
      await webpush.sendNotification({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth_secret}},
        orderPushPayload(job.code),{vapidDetails:{subject:config.subject,publicKey:config.publicKey,privateKey:config.privateKey},
          TTL:3600,urgency:"high",timeout:10000,agent:pushAgentForEndpoint(job.endpoint),topic:job.code});
      await client.query("UPDATE admin_push_job SET status='sent',sent_at=now(),attempts=attempts+1,last_error=NULL WHERE id=$1",[job.id]);
    } catch (error) {
      const status = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) {
        await client.query("DELETE FROM admin_push_subscription WHERE endpoint=$1",[job.endpoint]);
      } else if (status >= 400 && status < 500 && status !== 429) {
        await client.query("UPDATE admin_push_job SET status='expired',attempts=attempts+1,last_error='PUSH_REJECTED' WHERE id=$1",[job.id]);
      } else {
        await client.query(`UPDATE admin_push_job SET status='failed',attempts=attempts+1,last_error='PUSH_SEND_FAILED',
          next_attempt=now()+LEAST(3600,30*power(2,attempts))*interval '1 second' WHERE id=$1`,[job.id]);
      }
    }
    return true;
  });
}

export async function saveAdminPushSubscription(userId: string, value: z.infer<typeof adminPushSubscriptionSchema>) {
  await query(`INSERT INTO admin_push_subscription(user_id,endpoint,p256dh,auth_secret) VALUES($1,$2,$3,$4)
    ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,p256dh=EXCLUDED.p256dh,
      auth_secret=EXCLUDED.auth_secret,last_seen_at=now()`,[userId,value.endpoint,value.keys.p256dh,value.keys.auth]);
}

export async function deleteAdminPushSubscription(userId: string, endpoint: string) {
  await query("DELETE FROM admin_push_subscription WHERE user_id=$1 AND endpoint=$2",[userId,endpoint]);
}

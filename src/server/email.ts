import { createHash } from "node:crypto";
import {createSmtpTransport} from "./smtp";
import type { PoolClient } from "pg";
import { query, transaction } from "./db";

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function enqueueEmail(kind: string, userId: string, recipient: string, url: string, dedupKey: string, client?: PoolClient) {
  const sql = "INSERT INTO email_outbox(user_id,kind,recipient,dedup_key,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(dedup_key) DO NOTHING";
  const values = [userId,kind,recipient,dedupKey,JSON.stringify({url})];
  if(client) await client.query(sql,values); else await query(sql,values);
}

export async function enqueueAccountEmail(kind: "activation" | "password_reset", userId: string, email: string, url: string, token: string, ttl: number) {
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`account-email:${userId}:${kind}`]);
    await client.query("UPDATE account_token SET revoked_at=now() WHERE user_id=$1 AND kind=$2 AND consumed_at IS NULL AND revoked_at IS NULL",[userId,kind]);
    await client.query("UPDATE email_outbox SET status='cancelled',payload=NULL WHERE user_id=$1 AND kind=$2 AND status IN ('pending','failed')",[userId,kind]);
    await client.query("INSERT INTO account_token(token_hash,user_id,kind,expires_at) VALUES($1,$2,$3,now()+$4*interval '1 second')",[tokenHash(token),userId,kind,ttl]);
    await client.query("INSERT INTO email_outbox(user_id,kind,recipient,dedup_key,payload,expires_at) VALUES($1,$2,$3,$4,$5,now()+$6*interval '1 second')",[userId,kind,email,`${kind}:${tokenHash(token)}`,JSON.stringify({url}),ttl]);
  });
}

export async function processOneEmail(): Promise<boolean> {
  return transaction(async client => {
    const result = await client.query("SELECT * FROM email_outbox WHERE status IN ('pending','failed') AND next_attempt<=now() AND attempts<10 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
    const job = result.rows[0];
    if(!job) return false;
    if(job.expires_at && new Date(job.expires_at).getTime()<Date.now()) {
      await client.query("UPDATE email_outbox SET status='expired',payload=NULL WHERE id=$1",[job.id]); return true;
    }
    try {
      if(job.kind==="activation_request"){
        const {requestActivation}=await import("./account");
        await requestActivation(job.user_id);
        await client.query("UPDATE email_outbox SET status='sent',sent_at=now(),payload=NULL,attempts=attempts+1,last_error=NULL WHERE id=$1",[job.id]);
        return true;
      }
      if(!process.env.SMTP_HOST || !process.env.EMAIL_FROM) throw new Error("SMTP_NOT_CONFIGURED");
      const transport = createSmtpTransport();
      const subject = job.kind === "activation" ? "Aktifkan akun Kalkulator HPP Kuliner" : job.kind === "password_reset" ? "Atur ulang password HPP Kuliner" : "Akses Kalkulator HPP Kuliner diberikan";
      const text = `${subject}\n\n${job.payload?.url || process.env.APP_BASE_URL}\n\n${job.kind==='activation'?'Tautan berlaku 24 jam.':job.kind==='password_reset'?'Tautan berlaku 60 menit.':''}\nBantuan: ${process.env.SUPPORT_CONTACT_URL||process.env.APP_BASE_URL}`;
      const sent = await transport.sendMail({from:process.env.EMAIL_FROM,to:job.recipient,subject,text,messageId:`<hpp-${job.id}@${new URL(process.env.APP_BASE_URL!).hostname}>`});
      await client.query("UPDATE email_outbox SET status='sent',sent_at=now(),provider_message_id=$2,payload=NULL,attempts=attempts+1,last_error=NULL WHERE id=$1",[job.id,sent.messageId]);
    } catch(error) {
      const code = error instanceof Error && error.message === "SMTP_NOT_CONFIGURED" ? "SMTP_NOT_CONFIGURED" : "SMTP_SEND_FAILED";
      const delay = Math.min(3600,60*2**job.attempts);
      await client.query("UPDATE email_outbox SET status='failed',attempts=attempts+1,last_error=$2,next_attempt=now()+$3*interval '1 second' WHERE id=$1",[job.id,code,delay]);
    }
    return true;
  });
}

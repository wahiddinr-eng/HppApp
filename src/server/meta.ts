import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { PoolClient } from "pg";
import { query, transaction } from "./db";
import { metaConfig } from "./meta-settings";
import { postMetaEvent } from "./meta-transport";
import { validFbc } from "@/lib/meta-click-id";
export { metaConfig } from "./meta-settings";

export const META_PRODUCT_ID = "kulinerkit_bundle";
type MetaEventName = "ViewContent" | "InitiateCheckout" | "Purchase";
type MetaContext = { client_ip_address?: string; client_user_agent?: string; fbp?: string; fbc?: string };
type MetaEvent = { event_name: MetaEventName; event_time: number; event_id: string; event_source_url: string; action_source: "website"; user_data: Record<string, string>; custom_data: Record<string, unknown> };

function cookie(request: Request, name: string) {
  const match = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  if (!match) return undefined;
  try { return decodeURIComponent(match.slice(name.length + 1)); } catch { return undefined; }
}

export function captureMetaContext(request: Request): MetaContext {
  // The reverse proxy must overwrite these headers; never use an admin request for Purchase attribution.
  const candidate = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ip = isIP(candidate) ? candidate : undefined;
  const agent = request.headers.get("user-agent")?.slice(0, 512) || undefined;
  const fbp = cookie(request, "_fbp");
  const fbc = cookie(request, "_fbc");
  return {
    ...(ip ? { client_ip_address: ip } : {}),
    ...(agent ? { client_user_agent: agent } : {}),
    ...(fbp && /^fb\.1\.\d{10,16}\.[A-Za-z0-9._-]{1,200}$/.test(fbp) ? { fbp } : {}),
    ...(validFbc(fbc) ? { fbc } : {}),
  };
}

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function customData(value: number, orderCode?: string) {
  return { currency: "IDR", value, content_name: "KulinerKit", content_category: "Toolkit usaha kuliner", content_type: "product",
    content_ids: [META_PRODUCT_ID], contents: [{ id: META_PRODUCT_ID, quantity: 1, item_price: value }], num_items: 1,
    ...(orderCode ? { order_id: orderCode } : {}) };
}

function sourceUrl(path: "/" | "/checkout" | "/pay/verified") { return new URL(path, process.env.APP_BASE_URL!).toString(); }
export function buildPageMetaEvent(name: "ViewContent" | "InitiateCheckout", eventId: string, price: number, context: MetaContext): MetaEvent {
  return { event_name: name, event_time: Math.floor(Date.now() / 1000), event_id: eventId,
    event_source_url: sourceUrl(name === "ViewContent" ? "/" : "/checkout"), action_source: "website",
    user_data: context, custom_data: customData(price) };
}

export async function enqueuePageMetaEvent(name: "ViewContent" | "InitiateCheckout", eventId: string, price: number, request: Request) {
  const config = await metaConfig();
  if (!config.enabled) return;
  const payload = buildPageMetaEvent(name, eventId, price, captureMetaContext(request));
  await query("INSERT INTO meta_event_outbox(event_id,event_name,pixel_id,test_event_code,event_time,payload) VALUES($1,$2,$3,$4,to_timestamp($5),$6) ON CONFLICT(event_id) DO NOTHING",
    [eventId, name, config.pixelId, config.testEventCode, payload.event_time, JSON.stringify(payload)]);
}

export function buildPurchaseMetaEvent(order: {id:string;code:string;price:number;customer_name:string;customer_email:string;customer_phone:string|null;meta_context:MetaContext}): MetaEvent {
  const email = order.customer_email.trim().toLowerCase();
  const phone = order.customer_phone?.replace(/\D/g, "");
  const user_data: Record<string,string> = { em: hash(email), external_id: hash(email), ...order.meta_context };
  if (phone) user_data.ph = hash(phone);
  const names = order.customer_name.trim().toLowerCase().split(/\s+/).map(part => part.replace(/[^\p{L}]/gu, "")).filter(Boolean);
  if (names[0]) user_data.fn = hash(names[0]);
  if (names.length > 1) user_data.ln = hash(names.at(-1)!);
  const event: MetaEvent = { event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), event_id: `kulinerkit-purchase-${order.id}`,
    event_source_url: sourceUrl("/pay/verified"), action_source: "website", user_data, custom_data: customData(order.price, order.code) };
  return event;
}

export async function enqueuePurchaseMetaEvent(client: PoolClient, order: Parameters<typeof buildPurchaseMetaEvent>[0]) {
  const config = await metaConfig(client);
  if (!config.enabled) return;
  const event = buildPurchaseMetaEvent(order);
  await client.query("INSERT INTO meta_event_outbox(event_id,event_name,pixel_id,test_event_code,order_id,event_time,payload) VALUES($1,'Purchase',$2,$3,$4,to_timestamp($5),$6) ON CONFLICT(event_id) DO UPDATE SET status='pending',pixel_id=EXCLUDED.pixel_id,test_event_code=EXCLUDED.test_event_code,event_time=EXCLUDED.event_time,payload=EXCLUDED.payload,attempts=0,next_attempt=now(),last_error=NULL WHERE meta_event_outbox.status='cancelled'",
    [event.event_id, config.pixelId, config.testEventCode, order.id, event.event_time, JSON.stringify(event)]);
}

export async function cancelUnsentPurchaseMetaEvent(client: PoolClient, orderId: string) {
  await client.query("UPDATE meta_event_outbox SET status='cancelled',payload=NULL WHERE order_id=$1 AND event_name='Purchase' AND status IN ('pending','failed')", [orderId]);
}

export async function purchaseBrowserEvent(orderId: string) {
  const config = await metaConfig();
  if (!config.enabled) return null;
  const result = await query<{event_id:string;pixel_id:string|null;test_event_code:string;status:string}>(
    "SELECT event_id,pixel_id,test_event_code,status FROM meta_event_outbox WHERE order_id=$1 AND event_name='Purchase'",
    [orderId]);
  const event = result.rows[0];
  if (!event || !["pending","failed","sent"].includes(event.status) || event.pixel_id !== config.pixelId || event.test_event_code !== config.testEventCode) return null;
  return { eventId: event.event_id, pixelId: config.pixelId };
}

export async function processOneMetaEvent(): Promise<boolean> {
  return transaction(async client => {
    const result = await client.query("SELECT * FROM meta_event_outbox WHERE status IN ('pending','failed') AND next_attempt<=now() AND attempts<10 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
    const job = result.rows[0];
    if (!job) return false;
    const config = await metaConfig(client);
    if (!config.requestedEnabled || (job.pixel_id && job.pixel_id !== config.pixelId) || job.test_event_code !== config.testEventCode) {
      await client.query("UPDATE meta_event_outbox SET status='cancelled',payload=NULL WHERE id=$1", [job.id]); return true;
    }
    if (Date.now() - new Date(job.event_time).getTime() > 6 * 24 * 3600_000) {
      await client.query("UPDATE meta_event_outbox SET status='expired',payload=NULL WHERE id=$1", [job.id]); return true;
    }
    if (!config.enabled) return false;
    try {
      const url = `https://graph.facebook.com/${config.version}/${config.pixelId}/events`;
      const body = await postMetaEvent(url, config.token!, { data: [job.payload], ...(job.test_event_code ? { test_event_code: job.test_event_code } : {}) });
      if (body.events_received !== 1) throw new Error("META_EVENT_NOT_RECEIVED");
      await client.query("UPDATE meta_event_outbox SET status='sent',sent_at=now(),payload=NULL,last_error=NULL,attempts=attempts+1 WHERE id=$1", [job.id]);
    } catch (error) {
      const code = error instanceof Error && /^HTTP_\d{3}$/.test(error.message) ? error.message : "META_SEND_FAILED";
      const delay = Math.min(3600, 60 * 2 ** job.attempts);
      await client.query("UPDATE meta_event_outbox SET status='failed',attempts=attempts+1,last_error=$2,next_attempt=now()+$3*interval '1 second' WHERE id=$1", [job.id, code, delay]);
    }
    return true;
  });
}

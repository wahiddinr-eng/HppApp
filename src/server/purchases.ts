import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { query } from "./db";
import { DomainError } from "./http";

const id=z.string().min(1).max(128);
export const purchaseEventSchema=z.object({
  schema_version:z.literal("1"),event_id:id,type:z.enum(["purchase.paid","purchase.refunded","purchase.chargeback"]),source:id,occurred_at:z.iso.datetime(),
  purchase:z.object({id,state_version:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),payment_status:z.enum(["paid","pending","refunded","chargeback","partially_refunded"]),currency:z.string().length(3),amount_paid:z.string().regex(/^\d+(\.\d{1,6})?$/).max(30),
    customer:z.object({email:z.string().max(254).transform(value=>value.trim().toLowerCase()).pipe(z.email()),name:z.string().max(120)}),
    items:z.array(z.object({id,product_id:id,quantity:z.number().int().positive().max(1000000),access_status:z.enum(["paid","refunded","chargeback","partially_refunded"])})).min(1).max(100)})
});
export type PurchaseEvent=z.infer<typeof purchaseEventSchema>;
export function purchaseConfig(){
  let keys:Record<string,{secret:string;source:string}>;
  try{keys=z.record(z.string(),z.object({secret:z.string().min(32).refine(value=>!value.includes("CHANGE_ME")),source:z.string().min(1)})).parse(JSON.parse(process.env.PURCHASE_WEBHOOK_KEYS||"{}"));}catch{throw new DomainError(503,"WEBHOOK_CONFIG","Konfigurasi webhook belum lengkap.");}
  const source=process.env.PURCHASE_SOURCE_ID;const products=(process.env.ELIGIBLE_AI_FOOD_PRODUCT_IDS||"").split(",").map(value=>value.trim()).filter(Boolean);
  if(!source||!products.length||!Object.keys(keys).length)throw new DomainError(503,"WEBHOOK_CONFIG","Konfigurasi webhook belum lengkap.");
  return {keys,source,products};
}
export function verifyPurchaseSignature(raw:Uint8Array,headers:Headers,now=Date.now()){
  const config=purchaseConfig();const keyId=headers.get("x-hpp-key-id")||"";const key=config.keys[keyId];
  const timestamp=headers.get("x-hpp-timestamp")||"";const signature=headers.get("x-hpp-signature")||"";
  if(!key||key.secret.length<32||key.source!==config.source||!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!/^sha256=[a-f0-9]{64}$/i.test(signature))throw new DomainError(401,"INVALID_SIGNATURE","Signature atau waktu pengiriman tidak valid.");
  const expected=createHmac("sha256",key.secret).update(timestamp+".").update(raw).digest();
  const provided=Buffer.from(signature.slice(7),"hex");
  if(!timingSafeEqual(expected,provided))throw new DomainError(401,"INVALID_SIGNATURE","Signature tidak valid.");
  return key.source;
}
export async function receivePurchase(raw:Uint8Array,headers:Headers){
  const source=verifyPurchaseSignature(raw,headers);let value:unknown;
  try{value=JSON.parse(Buffer.from(raw).toString("utf8"));}catch{throw new DomainError(400,"INVALID_JSON","Format JSON tidak valid.");}
  const parsed=purchaseEventSchema.safeParse(value);if(!parsed.success)throw new DomainError(422,"INVALID_WEBHOOK","Payload webhook tidak sesuai kontrak.");
  const event=parsed.data;
  if(event.source!==source)throw new DomainError(401,"INVALID_SOURCE","Sumber event tidak cocok dengan key.");
  if(new Set(event.purchase.items.map(item=>item.id)).size!==event.purchase.items.length)throw new DomainError(422,"DUPLICATE_ITEMS","ID item purchase harus unik.");
  const hash=createHash("sha256").update(raw).digest("hex");
  const result=await query("INSERT INTO webhook_event(source,event_id,body_hash,payload) VALUES($1,$2,$3,$4) ON CONFLICT(source,event_id) DO NOTHING RETURNING id",[source,event.event_id,hash,JSON.stringify(event)]);
  if(result.rowCount)return {status:202,code:"ACCEPTED"};
  const existing=await query<{body_hash:string}>("SELECT body_hash FROM webhook_event WHERE source=$1 AND event_id=$2",[source,event.event_id]);
  if(existing.rows[0].body_hash!==hash){await query("INSERT INTO audit_log(action,target,reason) VALUES('webhook_conflict',$1,'event_id dengan payload berbeda')",[source+":"+event.event_id]);throw new DomainError(409,"EVENT_CONFLICT","Event ID telah digunakan dengan payload berbeda.");}
  return {status:200,code:"DUPLICATE"};
}

import { randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { auth } from "./auth";
import { query, transaction } from "./db";
import { enqueueEmail, tokenHash } from "./email";
import { DomainError } from "./http";
import { cancelUnsentPurchaseMetaEvent, enqueuePurchaseMetaEvent } from "./meta";
import { enqueueOrderPush } from "./admin-push";
import type { captureMetaContext } from "./meta";

export const checkoutSettingsSchema = z.object({
  price: z.number().int().min(1000).max(100000000),
  comparePrice: z.number().int().min(1001).max(100000000),
  enabled: z.boolean(),
  bankName: z.string().trim().max(100),
  accountNumber: z.string().trim().max(60),
  accountHolder: z.string().trim().max(100),
  expectedCampaignId: z.uuid(),
  promoEnabled: z.boolean(),
  promoName: z.string().trim().max(80).refine(value=>!/[\r\n\p{Cc}]/u.test(value),"Nama promo tidak boleh mengandung karakter kontrol."),
  promoLimit: z.number().int().min(1).max(100000),
  promoDeadline: z.iso.datetime({offset:true}).nullable(),
}).refine(value => value.comparePrice>value.price,{message:"Harga coret harus lebih besar dari harga jual.",path:["comparePrice"]});

export const orderSchema=z.object({
  name:z.string().trim().min(2).max(100).refine(value=>!/\p{Cc}/u.test(value),"Nama tidak boleh berisi baris baru atau karakter kontrol."),
  email:z.email().max(254).transform(value=>value.trim().toLowerCase()),
  phone:z.string().trim().min(10).max(30)
    .transform(value=>value.replace(/[\s().-]/g,""))
    .refine(value=>/^(?:\+62|62|0)8[0-9]{8,11}$/.test(value),"Gunakan nomor HP Indonesia, misalnya 081234567890.")
    .transform(value=>`+62${value.replace(/^(?:\+62|62|0)/,"")}`),
  method:z.enum(["qris","bank"]),
  website:z.string().max(100).optional(),
});

export const newPromoCampaignSchema=z.object({
  expectedCampaignId:z.uuid(),
  name:z.string().trim().max(80).refine(value=>!/[\r\n\p{Cc}]/u.test(value),"Nama promo tidak boleh mengandung karakter kontrol."),
  limit:z.number().int().min(1).max(100000),
  deadline:z.iso.datetime({offset:true}).nullable(),
  confirmation:z.literal("MULAI_PROMO_BARU"),
});

export type CheckoutSettings={price:number;compare_price:number;enabled:boolean;bank_name:string;account_number:string;account_holder:string;qris_image_key:string|null;qris_image_mime:string|null;promo_enabled:boolean;promo_name:string;promo_limit:number;promo_campaign_id:string;promo_deadline:Date|null};

export async function getCheckoutSettings(client?:PoolClient):Promise<CheckoutSettings>{
  const result=await (client?client.query<CheckoutSettings>("SELECT * FROM checkout_settings WHERE id=1 FOR UPDATE"):query<CheckoutSettings>("SELECT * FROM checkout_settings WHERE id=1"));
  if(!result.rows[0])throw new DomainError(503,"CHECKOUT_NOT_READY","Checkout belum disiapkan.");
  return result.rows[0];
}

export async function getPromoStatus(settings:CheckoutSettings,client?:PoolClient){
  const result=await (client?client.query<{reserved:number}>("SELECT count(*)::int AS reserved FROM checkout_order WHERE promo_campaign_id=$1 AND status IN ('pending','complete')",[settings.promo_campaign_id]):query<{reserved:number}>("SELECT count(*)::int AS reserved FROM checkout_order WHERE promo_campaign_id=$1 AND status IN ('pending','complete')",[settings.promo_campaign_id]));
  const reserved=result.rows[0]?.reserved??0;
  const remaining=Math.max(0,settings.promo_limit-reserved);
  const expired=Boolean(settings.promo_deadline&&settings.promo_deadline.getTime()<=Date.now());
  return {enabled:settings.promo_enabled,name:settings.promo_name,limit:settings.promo_limit,remaining,deadline:settings.promo_deadline?.toISOString()??null,active:settings.promo_enabled&&remaining>0&&!expired,expired};
}

export async function getPromoCampaignHistory(){
  const result=await query<{id:string;name:string;quota_limit:number;deadline:Date|null;started_at:Date;ended_at:Date|null;completed:number;pending:number;failed:number}>("SELECT c.id,c.name,c.quota_limit,c.deadline,c.started_at,c.ended_at,count(o.id) FILTER (WHERE o.status='complete')::int AS completed,count(o.id) FILTER (WHERE o.status='pending')::int AS pending,count(o.id) FILTER (WHERE o.status='failed')::int AS failed FROM checkout_promo_campaign c LEFT JOIN checkout_order o ON o.promo_campaign_id=c.id GROUP BY c.id ORDER BY c.started_at DESC,c.id DESC LIMIT 20");
  return result.rows;
}

export async function startNewPromoCampaign(input:z.infer<typeof newPromoCampaignSchema>,actorId:string){
  if(input.deadline&&new Date(input.deadline).getTime()<=Date.now())throw new DomainError(422,"PROMO_DEADLINE_PAST","Batas waktu promo baru harus di masa depan.");
  return transaction(async client=>{
    const current=await getCheckoutSettings(client);
    if(current.promo_campaign_id!==input.expectedCampaignId)throw new DomainError(409,"PROMO_CHANGED","Promo sudah berubah. Muat ulang pengaturan sebelum memulai promo baru.");
    if(!current.enabled)throw new DomainError(422,"CHECKOUT_CLOSED","Buka checkout sebelum memulai promo baru.");
    const pending=await client.query<{n:number}>("SELECT count(*)::int AS n FROM checkout_order WHERE promo_campaign_id=$1 AND status='pending'",[current.promo_campaign_id]);
    if((pending.rows[0]?.n??0)>0)throw new DomainError(409,"PROMO_PENDING_ORDERS","Masih ada pesanan promo menunggu pembayaran. Selesaikan atau tandai failed sebelum memulai promo baru.");
    const old=await client.query("UPDATE checkout_promo_campaign SET ended_at=now() WHERE id=$1 AND ended_at IS NULL RETURNING id",[current.promo_campaign_id]);
    if(!old.rowCount)throw new DomainError(503,"PROMO_HISTORY_MISSING","Riwayat promo belum siap. Jalankan migrasi database.");
    const id=randomUUID();
    await client.query("INSERT INTO checkout_promo_campaign(id,name,quota_limit,deadline,created_by) VALUES($1,$2,$3,$4,$5)",[id,input.name,input.limit,input.deadline,actorId]);
    await client.query("UPDATE checkout_settings SET promo_campaign_id=$1,promo_name=$2,promo_limit=$3,promo_deadline=$4,promo_enabled=true,updated_at=now() WHERE id=1",[id,input.name,input.limit,input.deadline]);
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'promo_campaign_started',$2,$3)",[actorId,id,`previous:${current.promo_campaign_id}`]);
    return {id,message:"Promo baru dimulai. Kuota kembali penuh untuk promo ini."};
  });
}

export function publicCheckoutSettings(settings:CheckoutSettings,promo?:Awaited<ReturnType<typeof getPromoStatus>>){
  return {price:settings.price,comparePrice:settings.compare_price,enabled:settings.enabled&&(!promo?.enabled||promo.active),promo:promo??null,
    methods:{qris:Boolean(settings.qris_image_key),bank:Boolean(settings.bank_name&&settings.account_number&&settings.account_holder)}};
}

function baseUrl(){const value=process.env.APP_BASE_URL;if(!value)throw new DomainError(503,"CHECKOUT_NOT_READY","Alamat aplikasi belum dikonfigurasi.");return value;}
function paymentUrl(token:string){return new URL(`/pay/${token}`,baseUrl()).toString();}

export async function createCheckoutOrder(input:z.infer<typeof orderSchema>,metaContext:ReturnType<typeof captureMetaContext>={}){
  if(input.website)throw new DomainError(422,"INVALID_ORDER","Pesanan tidak valid.");
  return transaction(async client=>{
    const settings=await getCheckoutSettings(client);
    if(!settings.enabled)throw new DomainError(503,"CHECKOUT_CLOSED","Checkout belum dibuka. Silakan hubungi tim KulinerKit.");
    const promo=await getPromoStatus(settings,client);
    if(promo.enabled&&!promo.active)throw new DomainError(409,"PROMO_ENDED","Kuota atau masa promo telah berakhir. Silakan hubungi tim KulinerKit.");
    if(promo.enabled){
      const duplicate=await client.query("SELECT 1 FROM checkout_order WHERE promo_campaign_id=$1 AND customer_email=$2 AND status IN ('pending','complete') LIMIT 1",[settings.promo_campaign_id,input.email]);
      if(duplicate.rowCount)throw new DomainError(409,"PROMO_ALREADY_RESERVED","Email ini sudah memiliki pesanan promo. Periksa email untuk tautan pembayaran atau hubungi tim KulinerKit.");
    }
    if(input.method==="qris"&&!settings.qris_image_key || input.method==="bank"&&!(settings.bank_name&&settings.account_number&&settings.account_holder))
      throw new DomainError(422,"PAYMENT_METHOD_UNAVAILABLE","Metode pembayaran belum tersedia.");
    const token=randomBytes(32).toString("hex");
    const code=`KK-${randomBytes(6).toString("hex").toUpperCase()}`;
    const snapshot=input.method==="qris"?{imageKey:settings.qris_image_key,imageMime:settings.qris_image_mime}:{bankName:settings.bank_name,accountNumber:settings.account_number,accountHolder:settings.account_holder};
    const result=await client.query<{id:string}>("INSERT INTO checkout_order(code,token_hash,customer_name,customer_email,customer_phone,payment_method,price,compare_price,payment_snapshot,meta_context,promo_campaign_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",[code,tokenHash(token),input.name,input.email,input.phone,input.method,settings.price,settings.compare_price,JSON.stringify(snapshot),JSON.stringify(metaContext),promo.enabled?settings.promo_campaign_id:null]);
    const url=paymentUrl(token);
    const payload={code,name:input.name,phone:input.phone,method:input.method,price:settings.price,url};
    await client.query("INSERT INTO email_outbox(kind,recipient,dedup_key,payload) VALUES('checkout_payment',$1,$2,$3)",[input.email,`checkout:${result.rows[0].id}:customer`,JSON.stringify(payload)]);
    const admins=await client.query<{email:string}>('SELECT u.email FROM "user" u JOIN user_profile p ON p.user_id=u.id WHERE p.role=$1 AND p.account_status=$2',["admin","active"]);
    for(const admin of admins.rows) await client.query("INSERT INTO email_outbox(kind,recipient,dedup_key,payload) VALUES('checkout_admin',$1,$2,$3)",[admin.email,`checkout:${result.rows[0].id}:admin:${admin.email}`,JSON.stringify({...payload,url:new URL('/admin/transactions',baseUrl()).toString(),email:input.email})]);
    await enqueueOrderPush(client,result.rows[0].id);
    await client.query("INSERT INTO audit_log(action,target,reason) VALUES('checkout_created',$1,$2)",[result.rows[0].id,input.method]);
    return {code,url};
  });
}

export async function findCheckoutOrder(token:string){
  if(!/^[a-f0-9]{64}$/.test(token))throw new DomainError(404,"ORDER_NOT_FOUND","Pesanan tidak ditemukan.");
  const result=await query("SELECT id,code,customer_name,customer_email,customer_phone,payment_method,price,compare_price,payment_snapshot,status,created_at,updated_at FROM checkout_order WHERE token_hash=$1",[tokenHash(token)]);
  if(!result.rows[0])throw new DomainError(404,"ORDER_NOT_FOUND","Pesanan tidak ditemukan.");
  return result.rows[0];
}

export async function setCheckoutOrderStatus(id:string,status:"pending"|"failed"|"complete",version:number,actorId:string,reason:string){
  return transaction(async client=>{
    const result=await client.query("SELECT * FROM checkout_order WHERE id=$1 FOR UPDATE",[id]);
    const order=result.rows[0];if(!order)throw new DomainError(404,"ORDER_NOT_FOUND","Pesanan tidak ditemukan.");
    if(order.version!==version)throw new DomainError(409,"ORDER_CHANGED","Pesanan sudah berubah. Muat ulang sebelum mengubah status.");
    if(order.status===status)throw new DomainError(422,"STATUS_UNCHANGED","Status pesanan tidak berubah.");
    let userId:string|null=order.user_id;
    if(status==="complete"){
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",["email:"+order.customer_email]);
      const existing=order.user_id
        ? await client.query('SELECT id FROM "user" WHERE id=$1',[order.user_id])
        : await client.query('SELECT id FROM "user" WHERE email=$1',[order.customer_email]);
      userId=existing.rows[0]?.id||null;
      if(!userId){const created=await auth.api.createUser({body:{email:order.customer_email,name:order.customer_name,role:"user"}});userId=created.user.id;}
      await client.query("INSERT INTO user_profile(user_id,display_name,phone) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET phone=COALESCE(user_profile.phone,EXCLUDED.phone)",[userId,order.customer_name,order.customer_phone]);
      const profile=await client.query("SELECT account_status,role FROM user_profile WHERE user_id=$1",[userId]);
      if(profile.rows[0]?.role!=="user"||profile.rows[0]?.account_status==="suspended")throw new DomainError(422,"ACCOUNT_UNAVAILABLE","Akun customer perlu ditinjau sebelum akses diberikan.");
      const account=await client.query<{email:string}>('SELECT email FROM "user" WHERE id=$1',[userId]);
      for(const feature of ["hpp_calculator","prompt_gallery"]){
        await client.query("INSERT INTO access_grant(user_id,source,purchase_id,item_id,product_id,feature_key,status,reason) VALUES($1,'kulinerkit_direct',$2,'bundle','kulinerkit_bundle',$3,'active','checkout_complete') ON CONFLICT(source,purchase_id,item_id,feature_key) DO UPDATE SET user_id=COALESCE(access_grant.user_id,EXCLUDED.user_id),status=CASE WHEN access_grant.reason LIKE 'admin:%' THEN access_grant.status ELSE 'active' END,reason=CASE WHEN access_grant.reason LIKE 'admin:%' THEN access_grant.reason ELSE 'checkout_complete' END,updated_at=now()",[userId,order.id,feature]);
      }
      const kind=profile.rows[0].account_status==="pending_activation"?"activation_request":"access_given";
      await enqueueEmail(kind,userId!,account.rows[0].email,new URL("/login",baseUrl()).toString(),`checkout:${order.id}:${kind}:${version+1}`,client);
      await enqueuePurchaseMetaEvent(client,order);
    }else if(order.status==="complete"){
      await client.query("UPDATE access_grant SET status='revoked',reason='checkout_' || $2::text,updated_at=now() WHERE source='kulinerkit_direct' AND purchase_id=$1 AND reason NOT LIKE 'admin:%'",[order.id,status]);
      await cancelUnsentPurchaseMetaEvent(client,order.id);
    }
    await client.query("UPDATE checkout_order SET status=$2,version=version+1,user_id=$3,updated_at=now(),completed_at=CASE WHEN $2='complete' THEN now() ELSE NULL END WHERE id=$1",[id,status,userId]);
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,$2,$3,$4)",[actorId,`checkout_${status}`,id,reason]);
    return {message:`Status pesanan ${order.code} menjadi ${status}.`};
  });
}

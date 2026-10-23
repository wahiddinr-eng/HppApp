import { randomBytes } from "node:crypto";
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

export type CheckoutSettings={price:number;compare_price:number;enabled:boolean;bank_name:string;account_number:string;account_holder:string;qris_image_key:string|null;qris_image_mime:string|null};

export async function getCheckoutSettings(client?:PoolClient):Promise<CheckoutSettings>{
  const result=await (client?client.query<CheckoutSettings>("SELECT * FROM checkout_settings WHERE id=1 FOR UPDATE"):query<CheckoutSettings>("SELECT * FROM checkout_settings WHERE id=1"));
  if(!result.rows[0])throw new DomainError(503,"CHECKOUT_NOT_READY","Checkout belum disiapkan.");
  return result.rows[0];
}

export function publicCheckoutSettings(settings:CheckoutSettings){
  return {price:settings.price,comparePrice:settings.compare_price,enabled:settings.enabled,
    methods:{qris:Boolean(settings.qris_image_key),bank:Boolean(settings.bank_name&&settings.account_number&&settings.account_holder)}};
}

function baseUrl(){const value=process.env.APP_BASE_URL;if(!value)throw new DomainError(503,"CHECKOUT_NOT_READY","Alamat aplikasi belum dikonfigurasi.");return value;}
function paymentUrl(token:string){return new URL(`/pay/${token}`,baseUrl()).toString();}

export async function createCheckoutOrder(input:z.infer<typeof orderSchema>,metaContext:ReturnType<typeof captureMetaContext>={}){
  if(input.website)throw new DomainError(422,"INVALID_ORDER","Pesanan tidak valid.");
  return transaction(async client=>{
    const settings=await getCheckoutSettings(client);
    if(!settings.enabled)throw new DomainError(503,"CHECKOUT_CLOSED","Checkout belum dibuka. Silakan hubungi tim KulinerKit.");
    if(input.method==="qris"&&!settings.qris_image_key || input.method==="bank"&&!(settings.bank_name&&settings.account_number&&settings.account_holder))
      throw new DomainError(422,"PAYMENT_METHOD_UNAVAILABLE","Metode pembayaran belum tersedia.");
    const token=randomBytes(32).toString("hex");
    const code=`KK-${randomBytes(6).toString("hex").toUpperCase()}`;
    const snapshot=input.method==="qris"?{imageKey:settings.qris_image_key,imageMime:settings.qris_image_mime}:{bankName:settings.bank_name,accountNumber:settings.account_number,accountHolder:settings.account_holder};
    const result=await client.query<{id:string}>("INSERT INTO checkout_order(code,token_hash,customer_name,customer_email,customer_phone,payment_method,price,compare_price,payment_snapshot,meta_context) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",[code,tokenHash(token),input.name,input.email,input.phone,input.method,settings.price,settings.compare_price,JSON.stringify(snapshot),JSON.stringify(metaContext)]);
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
      const existing=await client.query('SELECT id FROM "user" WHERE email=$1',[order.customer_email]);
      userId=existing.rows[0]?.id||null;
      if(!userId){const created=await auth.api.createUser({body:{email:order.customer_email,name:order.customer_name,role:"user"}});userId=created.user.id;}
      await client.query("INSERT INTO user_profile(user_id,display_name) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING",[userId,order.customer_name]);
      const profile=await client.query("SELECT account_status,role FROM user_profile WHERE user_id=$1",[userId]);
      if(profile.rows[0]?.role!=="user"||profile.rows[0]?.account_status==="suspended")throw new DomainError(422,"ACCOUNT_UNAVAILABLE","Akun customer perlu ditinjau sebelum akses diberikan.");
      for(const feature of ["hpp_calculator","prompt_gallery"]){
        await client.query("INSERT INTO access_grant(user_id,source,purchase_id,item_id,product_id,feature_key,status,reason) VALUES($1,'kulinerkit_direct',$2,'bundle','kulinerkit_bundle',$3,'active','checkout_complete') ON CONFLICT(source,purchase_id,item_id,feature_key) DO UPDATE SET user_id=COALESCE(access_grant.user_id,EXCLUDED.user_id),status=CASE WHEN access_grant.reason LIKE 'admin:%' THEN access_grant.status ELSE 'active' END,reason=CASE WHEN access_grant.reason LIKE 'admin:%' THEN access_grant.reason ELSE 'checkout_complete' END,updated_at=now()",[userId,order.id,feature]);
      }
      const kind=profile.rows[0].account_status==="pending_activation"?"activation_request":"access_given";
      await enqueueEmail(kind,userId!,order.customer_email,new URL("/login",baseUrl()).toString(),`checkout:${order.id}:${kind}:${version+1}`,client);
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

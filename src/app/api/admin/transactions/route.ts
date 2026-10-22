import { z } from "zod";
import { setCheckoutOrderStatus } from "@/server/checkout";
import { query } from "@/server/db";
import { apiError,checkOrigin,DomainError,privateJson,readJson,requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
export async function GET(request:Request){try{
  await requireActor(request,"admin");
  const params=new URL(request.url).searchParams;
  const status=params.get("status")||"all";if(!["all","pending","failed","complete"].includes(status))throw new DomainError(422,"INVALID_STATUS","Status tidak valid.");
  const search=(params.get("search")||"").trim().slice(0,100);
  const page=Math.min(100,Math.max(1,Number(params.get("page"))||1));
  const [orders,total]=await Promise.all([
    query("SELECT id,code,customer_name,customer_email,customer_phone,payment_method,price,status,version,created_at,updated_at,completed_at FROM checkout_order WHERE ($1='all' OR status=$1) AND ($2='' OR code ILIKE $3 OR customer_email ILIKE $3 OR customer_phone ILIKE $3) ORDER BY created_at DESC LIMIT 30 OFFSET $4",[status,search,`%${search}%`,(page-1)*30]),
    query<{count:number}>("SELECT count(*)::int FROM checkout_order WHERE ($1='all' OR status=$1) AND ($2='' OR code ILIKE $3 OR customer_email ILIKE $3 OR customer_phone ILIKE $3)",[status,search,`%${search}%`])
  ]);
  return privateJson({orders:orders.rows,total:total.rows[0].count,page});
}catch(error){return apiError(error);}}
export async function PATCH(request:Request){try{
  checkOrigin(request);const actor=await requireActor(request,"admin");await rateLimit(`admin-transactions:${actor.id}`,30,60);
  const parsed=z.object({id:z.uuid(),status:z.enum(["pending","failed","complete"]),version:z.number().int().positive(),reason:z.string().trim().min(5).max(500)}).safeParse(await readJson(request,4096));
  if(!parsed.success)throw new DomainError(422,"INVALID_STATUS_CHANGE","Isi status dan alasan minimal 5 karakter.");
  const result=await setCheckoutOrderStatus(parsed.data.id,parsed.data.status,parsed.data.version,actor.id,parsed.data.reason);
  return privateJson(result);
}catch(error){return apiError(error);}}

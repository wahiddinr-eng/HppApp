import { checkoutSettingsSchema, getCheckoutSettings } from "@/server/checkout";
import { transaction } from "@/server/db";
import { apiError,checkOrigin,DomainError,privateJson,readJson,requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
export async function GET(request:Request){try{await requireActor(request,"admin");return privateJson(await getCheckoutSettings());}catch(error){return apiError(error);}}
export async function PUT(request:Request){try{
  checkOrigin(request);const actor=await requireActor(request,"admin");await rateLimit(`admin-checkout:${actor.id}`,20,60);
  const parsed=checkoutSettingsSchema.safeParse(await readJson(request,4096));
  if(!parsed.success)throw new DomainError(422,"INVALID_SETTINGS",parsed.error.issues[0]?.message||"Pengaturan tidak valid.");
  const body=parsed.data;
  await transaction(async client=>{
    const current=await getCheckoutSettings(client);
    if(body.enabled&&!current.qris_image_key&&!(body.bankName&&body.accountNumber&&body.accountHolder))throw new DomainError(422,"PAYMENT_METHOD_REQUIRED","Unggah QRIS atau isi rekening bank sebelum membuka checkout.");
    await client.query("UPDATE checkout_settings SET price=$1,compare_price=$2,enabled=$3,bank_name=$4,account_number=$5,account_holder=$6,updated_at=now() WHERE id=1",[body.price,body.comparePrice,body.enabled,body.bankName,body.accountNumber,body.accountHolder]);
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'checkout_settings','checkout', $2)",[actor.id,body.enabled?"enabled":"disabled"]);
  });
  return privateJson({message:"Pengaturan checkout disimpan."});
}catch(error){return apiError(error);}}

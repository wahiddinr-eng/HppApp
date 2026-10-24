import { checkoutSettingsSchema, getCheckoutSettings, getPromoCampaignHistory, getPromoStatus } from "@/server/checkout";
import { transaction } from "@/server/db";
import { apiError,checkOrigin,DomainError,privateJson,readJson,requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
export async function GET(request:Request){try{await requireActor(request,"admin");const settings=await getCheckoutSettings();const [promo,history]=await Promise.all([getPromoStatus(settings),getPromoCampaignHistory()]);return privateJson({...settings,promo,promo_history:history});}catch(error){return apiError(error);}}
export async function PUT(request:Request){try{
  checkOrigin(request);const actor=await requireActor(request,"admin");await rateLimit(`admin-checkout:${actor.id}`,20,60);
  const parsed=checkoutSettingsSchema.safeParse(await readJson(request,4096));
  if(!parsed.success)throw new DomainError(422,"INVALID_SETTINGS",parsed.error.issues[0]?.message||"Pengaturan tidak valid.");
  const body=parsed.data;
  await transaction(async client=>{
    const current=await getCheckoutSettings(client);
    if(current.promo_campaign_id!==body.expectedCampaignId)throw new DomainError(409,"PROMO_CHANGED","Promo sudah berubah. Muat ulang pengaturan sebelum menyimpan.");
    if(body.enabled&&!current.qris_image_key&&!(body.bankName&&body.accountNumber&&body.accountHolder))throw new DomainError(422,"PAYMENT_METHOD_REQUIRED","Unggah QRIS atau isi rekening bank sebelum membuka checkout.");
    await client.query("UPDATE checkout_settings SET price=$1,compare_price=$2,enabled=$3,bank_name=$4,account_number=$5,account_holder=$6,promo_enabled=$7,promo_name=$8,promo_limit=$9,promo_deadline=$10,updated_at=now() WHERE id=1",[body.price,body.comparePrice,body.enabled,body.bankName,body.accountNumber,body.accountHolder,body.promoEnabled,body.promoName,body.promoLimit,body.promoDeadline]);
    await client.query("UPDATE checkout_promo_campaign SET name=$2,quota_limit=$3,deadline=$4 WHERE id=$1",[current.promo_campaign_id,body.promoName,body.promoLimit,body.promoDeadline]);
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'checkout_settings','checkout', $2)",[actor.id,body.enabled?"enabled":"disabled"]);
  });
  return privateJson({message:"Pengaturan checkout disimpan."});
}catch(error){return apiError(error);}}

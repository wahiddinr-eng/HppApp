import { newPromoCampaignSchema, startNewPromoCampaign } from "@/server/checkout";
import { apiError,checkOrigin,DomainError,privateJson,readJson,requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export async function POST(request:Request){try{
  checkOrigin(request);const actor=await requireActor(request,"admin");await rateLimit(`admin-promo-new:${actor.id}`,5,3600);
  const parsed=newPromoCampaignSchema.safeParse(await readJson(request,2048));
  if(!parsed.success)throw new DomainError(422,"INVALID_PROMO",parsed.error.issues[0]?.message||"Pengaturan promo tidak valid.");
  return privateJson(await startNewPromoCampaign(parsed.data,actor.id));
}catch(error){return apiError(error);}}

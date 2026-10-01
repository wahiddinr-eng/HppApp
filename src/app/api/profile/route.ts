import { z } from "zod";
import { query } from "@/server/db";
import { apiError, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
export async function GET(request:Request){try{const user=await requireActor(request,"session");return privateJson({user});}catch(error){return apiError(error);}}
export async function PATCH(request:Request){try{
  checkOrigin(request);const user=await requireActor(request,"session");
  const parsed=z.object({businessName:z.string().max(120),displayName:z.string().max(120)}).safeParse(await readJson(request,4096));
  if(!parsed.success)throw new DomainError(422,"INVALID_PROFILE","Nama maksimal 120 karakter.");
  await query("UPDATE user_profile SET business_name=$2,display_name=$3,updated_at=now() WHERE user_id=$1",[user.id,parsed.data.businessName.trim(),parsed.data.displayName.trim()]);
  return privateJson({message:"Profil tersimpan."});
}catch(error){return apiError(error);}}

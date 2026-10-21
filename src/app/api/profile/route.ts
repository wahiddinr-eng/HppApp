import { z } from "zod";
import { query } from "@/server/db";
import { apiError, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
export async function GET(request:Request){try{
  const user=await requireActor(request,"session");
  const grants=await query<{feature_key:string}>("SELECT DISTINCT feature_key FROM access_grant WHERE user_id=$1 AND status='active' AND (expires_at IS NULL OR expires_at > NOW())",[user.id]);
  const guide=await query<{guide_completed_at:Date|null}>("SELECT guide_completed_at FROM user_profile WHERE user_id=$1",[user.id]);
  return privateJson({user,features:user.status==="active"?grants.rows.map(row=>row.feature_key):[],guideCompletedAt:guide.rows[0]?.guide_completed_at?.toISOString()??null});
}catch(error){return apiError(error);}}
export async function PATCH(request:Request){try{
  checkOrigin(request);const user=await requireActor(request,"session");
  const parsed=z.object({businessName:z.string().max(120),displayName:z.string().max(120)}).safeParse(await readJson(request,4096));
  if(!parsed.success)throw new DomainError(422,"INVALID_PROFILE","Nama maksimal 120 karakter.");
  await query("UPDATE user_profile SET business_name=$2,display_name=$3,updated_at=now() WHERE user_id=$1",[user.id,parsed.data.businessName.trim(),parsed.data.displayName.trim()]);
  return privateJson({message:"Profil tersimpan."});
}catch(error){return apiError(error);}}

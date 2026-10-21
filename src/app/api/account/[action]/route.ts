import { z } from "zod";
import { auth } from "@/server/auth";
import { query } from "@/server/db";
import { consumeAccountToken, normalizeEmail, requestActivation, tokenInfo } from "@/server/account";
import { apiError, checkConfigured, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{action:string}>}) {
  try {
    checkConfigured();const {action}=await params;
    if(action==="token") {
      const url=new URL(request.url);const kind=url.searchParams.get("kind")==="activation"?"activation":"password_reset";
      const info=await tokenInfo(url.searchParams.get("token")||"",kind);return privateJson({email:info.email});
    }
    if(action==="status") {
      const actor=await requireActor(request,"session");
      const grants=await query("SELECT id,feature_key,status,source,purchase_id,item_id,expires_at,created_at FROM access_grant WHERE user_id=$1 ORDER BY created_at DESC",[actor.id]);
      const active=actor.status==="active"?grants.rows.filter(g=>g.status==="active"&&(!g.expires_at||new Date(g.expires_at).getTime()>Date.now())):[];
      return privateJson({user:actor,grants:grants.rows,active:active.length>0,features:[...new Set(active.map(g=>g.feature_key))]});
    }
    throw new DomainError(404,"NOT_FOUND","Endpoint tidak ditemukan.");
  }catch(error){return apiError(error);}
}
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}) {
  try {
    checkConfigured();checkOrigin(request);const {action}=await params;const body=await readJson(request,8192);
    if(action==="activate"||action==="reset-password") {
      const parsed=z.object({token:z.string().min(10).max(256),password:z.string().min(12).max(128)}).safeParse(body);
      if(!parsed.success) throw new DomainError(422,"INVALID_INPUT","Token dan password 12–128 karakter diperlukan.");
      await rateLimit("token:"+parsed.data.token,10,60);
      await consumeAccountToken(parsed.data.token,parsed.data.password,action==="activate"?"activation":"password_reset");
      return privateJson({message:action==="activate"?"Akun berhasil diaktifkan. Silakan masuk.":"Password berhasil diubah. Silakan masuk kembali."});
    }
    if(action==="forgot-password"||action==="resend-activation") {
      const parsed=z.object({email:z.string().max(254).transform(normalizeEmail).pipe(z.email())}).safeParse(body);
      if(!parsed.success) throw new DomainError(422,"INVALID_EMAIL","Alamat email tidak valid.");
      const email=normalizeEmail(parsed.data.email);await rateLimit("account-email:"+email,3,600);
      const result=await query<{id:string;account_status:string}>('SELECT u.id,p.account_status FROM "user" u JOIN user_profile p ON p.user_id=u.id WHERE u.email=$1',[email]);const user=result.rows[0];
      if(action==="resend-activation" && user?.account_status==="pending_activation") await requestActivation(user.id);
      if(action==="forgot-password" && user?.account_status==="active") await auth.api.requestPasswordReset({body:{email,redirectTo:process.env.APP_BASE_URL+"/reset-password"}});
      return privateJson({message:"Jika email terdaftar dan memenuhi syarat, tautan akan dikirim."});
    }
    throw new DomainError(404,"NOT_FOUND","Endpoint tidak ditemukan.");
  }catch(error){return apiError(error);}
}

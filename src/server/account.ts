import { betterAuth } from "better-auth";
import { activationAuth, auth } from "./auth";
import { query, transaction } from "./db";
import { tokenHash } from "./email";
import { DomainError } from "./http";

export const normalizeEmail=(email:string)=>email.trim().toLowerCase();
export async function requestActivation(userId:string) {
  const result=await query<{email:string;account_status:string}>('SELECT u.email,p.account_status FROM "user" u JOIN user_profile p ON p.user_id=u.id WHERE u.id=$1',[userId]);
  const user=result.rows[0];
  if(user?.account_status!=="pending_activation") return;
  await activationAuth.api.requestPasswordReset({body:{email:user.email,redirectTo:process.env.APP_BASE_URL+"/activate"}});
}
export async function generateActivationLink(userId:string,actorId:string,reason:string) {
  const result=await query<{email:string;account_status:string;role:string}>('SELECT u.email,p.account_status,p.role FROM "user" u JOIN user_profile p ON p.user_id=u.id WHERE u.id=$1',[userId]);
  const user=result.rows[0];
  if(!user || user.role!=="user" || user.account_status!=="pending_activation") throw new DomainError(422,"NOT_PENDING","Hanya akun customer yang menunggu aktivasi dapat dibuatkan tautan.");
  const capture:{token?:string}={};
  // Let Better Auth create its own verification record; this callback deliberately does not send an email.
  const linkAuth=betterAuth({...activationAuth.options,emailAndPassword:{...activationAuth.options.emailAndPassword,
    sendResetPassword:async({user:target,token})=>{if(target.id===userId)capture.token=token;}
  }});
  await linkAuth.api.requestPasswordReset({body:{email:user.email,redirectTo:process.env.APP_BASE_URL+"/activate"}});
  if(!capture.token) throw new DomainError(503,"ACTIVATION_LINK_FAILED","Tautan belum dapat dibuat. Coba lagi.");
  const token=capture.token;
  const expiresAt=await transaction(async client=>{
    const state=await client.query('SELECT account_status,role FROM user_profile WHERE user_id=$1 FOR UPDATE',[userId]);
    if(state.rows[0]?.role!=="user" || state.rows[0]?.account_status!=="pending_activation") throw new DomainError(422,"NOT_PENDING","Akun tidak lagi menunggu aktivasi.");
    // The worker locks activation_request before issuing an email token. Take that row first to avoid a lock cycle.
    await client.query("UPDATE email_outbox SET status='cancelled',payload=NULL WHERE user_id=$1 AND kind='activation_request' AND status IN ('pending','failed')",[userId]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`account-email:${userId}:activation`]);
    await client.query("UPDATE account_token SET revoked_at=now() WHERE user_id=$1 AND kind='activation' AND consumed_at IS NULL AND revoked_at IS NULL",[userId]);
    await client.query("UPDATE email_outbox SET status='cancelled',payload=NULL WHERE user_id=$1 AND kind='activation' AND status IN ('pending','failed')",[userId]);
    const issued=await client.query<{expires_at:Date}>("INSERT INTO account_token(token_hash,user_id,kind,expires_at) VALUES($1,$2,'activation',now()+interval '24 hours') RETURNING expires_at",[tokenHash(token),userId]);
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'generate_activation_link',$2,$3)",[actorId,userId,reason]);
    return issued.rows[0].expires_at;
  });
  const url=new URL("/activate",process.env.APP_BASE_URL);url.searchParams.set("token",token);
  return {email:user.email,url:url.toString(),expiresAt:expiresAt.toISOString()};
}
export async function tokenInfo(token:string,kind:string) {
  if(token.length<10||token.length>256) throw new DomainError(400,"INVALID_TOKEN","Tautan tidak valid atau kedaluwarsa.");
  const result=await query<{user_id:string;email:string;account_status:string}>('SELECT t.user_id,u.email,p.account_status FROM account_token t JOIN "user" u ON u.id=t.user_id JOIN user_profile p ON p.user_id=t.user_id WHERE t.token_hash=$1 AND t.kind=$2 AND t.expires_at>now() AND t.consumed_at IS NULL AND t.revoked_at IS NULL',[tokenHash(token),kind]);
  const row=result.rows[0];
  if(!row || row.account_status==="suspended" || (kind==="activation" && row.account_status!=="pending_activation")) throw new DomainError(400,"INVALID_TOKEN","Tautan tidak valid atau kedaluwarsa.");
  return row;
}
export async function consumeAccountToken(token:string,password:string,kind:"activation"|"password_reset") {
  if(password.length<12||password.length>128) throw new DomainError(422,"INVALID_PASSWORD","Password harus 12–128 karakter.");
  await transaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",["account-email:"+((await tokenInfo(token,kind)).user_id)+":"+kind]);
    const result=await client.query("SELECT t.*,p.account_status FROM account_token t JOIN user_profile p ON p.user_id=t.user_id WHERE token_hash=$1 FOR UPDATE OF t",[tokenHash(token)]);
    const row=result.rows[0];
    if(!row || row.kind!==kind || row.consumed_at || row.revoked_at || new Date(row.expires_at).getTime()<Date.now() || row.account_status==="suspended" || (kind==="activation"&&row.account_status!=="pending_activation")) throw new DomainError(400,"INVALID_TOKEN","Tautan tidak valid atau sudah dipakai.");
    try { await (kind==="activation"?activationAuth:auth).api.resetPassword({body:{token,newPassword:password}}); }
    catch { throw new DomainError(400,"INVALID_TOKEN","Tautan tidak valid atau sudah dipakai."); }
    await client.query("UPDATE account_token SET consumed_at=now() WHERE token_hash=$1",[tokenHash(token)]);
    await client.query("UPDATE email_outbox SET payload=NULL,status=CASE WHEN status IN ('pending','failed') THEN 'cancelled' ELSE status END WHERE dedup_key=$1",[kind+":"+tokenHash(token)]);
    if(kind==="activation") {
      await client.query("UPDATE user_profile SET account_status='active',updated_at=now() WHERE user_id=$1 AND account_status='pending_activation'",[row.user_id]);
      await client.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1',[row.user_id]);
    }
  });
}

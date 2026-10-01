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

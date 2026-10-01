import { z } from "zod";
import { query,transaction } from "@/server/db";
import { enqueueEmail } from "@/server/email";
import { apiError,checkOrigin,DomainError,privateJson,readJson,requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
export async function GET(request:Request,{params}:{params:Promise<{area:string}>}){try{
  await requireActor(request,"admin");const {area}=await params;
  if(area==="access"){
    const search=(new URL(request.url).searchParams.get("search")||"").slice(0,254);
    const accounts=await query('SELECT u.id,u.email,u.name,p.account_status,p.role,p.business_name,p.created_at FROM "user" u JOIN user_profile p ON p.user_id=u.id WHERE u.email ILIKE $1 ORDER BY p.created_at DESC LIMIT 50',["%"+search+"%"]);
    const ids=accounts.rows.map(row=>row.id);const grants=ids.length?await query("SELECT id,user_id,source,purchase_id,item_id,product_id,status,reason,created_at FROM access_grant WHERE user_id=ANY($1::text[]) ORDER BY created_at DESC",[ids]):{rows:[]};
    return privateJson({accounts:accounts.rows.map(user=>({...user,grants:grants.rows.filter(grant=>grant.user_id===user.id)}))});
  }
  if(area==="integrations"){
    const events=await query("SELECT id,source,event_id,status,stage,attempts,last_error,created_at,next_attempt,payload->'purchase'->>'id' AS purchase_id FROM webhook_event ORDER BY created_at DESC LIMIT 100");
    const emails=await query("SELECT id,kind,recipient,status,attempts,last_error,created_at,next_attempt FROM email_outbox ORDER BY created_at DESC LIMIT 100");
    const worker=await query("SELECT name,last_seen FROM worker_health");return privateJson({events:events.rows,emails:emails.rows,worker:worker.rows});
  }
  throw new DomainError(404,"NOT_FOUND","Endpoint tidak ditemukan.");
}catch(error){return apiError(error);}}
export async function POST(request:Request,{params}:{params:Promise<{area:string}>}){try{
  checkOrigin(request);const actor=await requireActor(request,"admin");const {area}=await params;
  const parsed=z.object({action:z.enum(["revoke","restore","resend_activation","retry"]),id:z.string().min(1).max(128),reason:z.string().trim().min(5).max(500),kind:z.enum(["webhook","email"]).optional()}).safeParse(await readJson(request,4096));
  if(!parsed.success)throw new DomainError(422,"ADMIN_REASON_REQUIRED","Tindakan, ID, dan alasan minimal 5 karakter diperlukan.");const body=parsed.data;
  await rateLimit("admin:"+actor.id,30,60);
  await transaction(async client=>{
    if(area==="access"&&(body.action==="revoke"||body.action==="restore")){
      if(!z.uuid().safeParse(body.id).success)throw new DomainError(404,"NOT_FOUND","Grant tidak ditemukan.");
      const grant=await client.query("UPDATE access_grant SET status=$2,reason=$3,updated_at=now() WHERE id=$1 RETURNING id",[body.id,body.action==="restore"?"active":"revoked","admin:"+body.reason]);
      if(!grant.rowCount)throw new DomainError(404,"NOT_FOUND","Grant tidak ditemukan.");
    }else if(area==="access"&&body.action==="resend_activation"){
      await rateLimit("admin-activation:"+body.id,1,600);
      const user=await client.query('SELECT u.email,p.account_status FROM "user" u JOIN user_profile p ON p.user_id=u.id WHERE u.id=$1',[body.id]);
      if(user.rows[0]?.account_status!=="pending_activation")throw new DomainError(422,"NOT_PENDING","Akun tidak sedang menunggu aktivasi.");
      await enqueueEmail("activation_request",body.id,user.rows[0].email,process.env.APP_BASE_URL+"/activate","admin-resend:"+body.id+":"+Math.floor(Date.now()/600000),client);
    }else if(area==="integrations"&&body.action==="retry"&&body.kind){
      if(!z.uuid().safeParse(body.id).success)throw new DomainError(404,"NOT_FOUND","Job tidak ditemukan.");
      const table=body.kind==="webhook"?"webhook_event":"email_outbox";
      const result=await client.query("UPDATE "+table+" SET status='pending',attempts=0,next_attempt=now(),last_error=NULL WHERE id=$1 AND status='failed' RETURNING id",[body.id]);
      if(!result.rowCount)throw new DomainError(422,"JOB_NOT_FAILED","Hanya job gagal yang dapat diproses ulang.");
    }else throw new DomainError(422,"INVALID_ADMIN_ACTION","Tindakan tidak sesuai halaman.");
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,$2,$3,$4)",[actor.id,body.action,body.id,body.reason]);
  });
  return privateJson({message:"Tindakan admin tersimpan dan diaudit."});
}catch(error){return apiError(error);}}

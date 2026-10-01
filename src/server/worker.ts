import { createHash } from "node:crypto";
import { auth } from "./auth";
import { query, transaction } from "./db";
import { enqueueEmail } from "./email";
import { purchaseConfig, type PurchaseEvent } from "./purchases";

export async function processOneWebhook():Promise<boolean>{
  let jobId:string|undefined;
  try{
    return await transaction(async client=>{
      const jobs=await client.query("SELECT * FROM webhook_event WHERE status IN ('pending','failed') AND attempts<10 AND next_attempt<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
      const job=jobs.rows[0];if(!job)return false;jobId=job.id;const event=job.payload as PurchaseEvent;const purchase=event.purchase;
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[event.source+":"+purchase.id]);
      const finish=async(status:string,stage:string)=>{await client.query("UPDATE webhook_event SET status=$2,stage=$3,attempts=attempts+1,processed_at=now(),last_error=NULL WHERE id=$1",[job.id,status,stage]);return true;};
      const previous=await client.query("SELECT * FROM purchase_state WHERE source=$1 AND purchase_id=$2 FOR UPDATE",[event.source,purchase.id]);const old=previous.rows[0];
      const snapshot={...purchase,customer:{email:purchase.customer.email},items:[...purchase.items].sort((a,b)=>a.id.localeCompare(b.id))};
      const hash=createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
      if(old && Number(old.state_version)>purchase.state_version)return finish("ignored","older_version");
      if(old && Number(old.state_version)===purchase.state_version)return finish(old.snapshot_hash===hash?"ignored":"review_required",old.snapshot_hash===hash?"same_state":"version_conflict");
      if(old && old.customer_email!==purchase.customer.email)return finish("review_required","email_changed");
      await client.query("INSERT INTO purchase_state(source,purchase_id,state_version,customer_email,snapshot,snapshot_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(source,purchase_id) DO UPDATE SET state_version=EXCLUDED.state_version,snapshot=EXCLUDED.snapshot,snapshot_hash=EXCLUDED.snapshot_hash,updated_at=now()",[event.source,purchase.id,purchase.state_version,purchase.customer.email,JSON.stringify(snapshot),hash]);
      const eligible=purchase.items.filter(item=>purchaseConfig().products.includes(item.product_id));
      if(!eligible.length)return finish("ignored","ignored_product");
      if(purchase.currency!=="IDR")return finish("review_required","unsupported_currency");
      const paid=eligible.filter(item=>event.type==="purchase.paid"&&purchase.payment_status==="paid"&&item.access_status==="paid");
      let userId:string|undefined;let accountStatus:string|undefined;
      if(paid.length){
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",["email:"+purchase.customer.email]);
        const users=await client.query('SELECT id FROM "user" WHERE email=$1',[purchase.customer.email]);userId=users.rows[0]?.id;
        if(!userId){const created=await auth.api.createUser({body:{email:purchase.customer.email,name:purchase.customer.name||purchase.customer.email,role:"user"}});userId=created.user.id;}
        await client.query("INSERT INTO user_profile(user_id,display_name) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING",[userId,purchase.customer.name]);
        const profile=await client.query("SELECT account_status FROM user_profile WHERE user_id=$1",[userId]);accountStatus=profile.rows[0].account_status;
      }
      let review=false;
      for(const item of eligible){
        if(item.access_status==="partially_refunded"){review=true;continue;}
        const revoke=item.access_status==="refunded"||item.access_status==="chargeback";
        const activate=paid.some(row=>row.id===item.id);
        if(!revoke&&!activate)continue;
        const reason=revoke?item.access_status:"purchase_paid";
        await client.query("INSERT INTO access_grant(user_id,source,purchase_id,item_id,product_id,status,reason) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source,purchase_id,item_id,feature_key) DO UPDATE SET user_id=COALESCE(access_grant.user_id,EXCLUDED.user_id),status=CASE WHEN EXCLUDED.status='active' AND access_grant.reason LIKE 'admin:%' THEN access_grant.status ELSE EXCLUDED.status END,reason=CASE WHEN EXCLUDED.status='active' AND access_grant.reason LIKE 'admin:%' THEN access_grant.reason ELSE EXCLUDED.reason END,updated_at=now()",[userId||null,event.source,purchase.id,item.id,item.product_id,revoke?"revoked":"active",reason]);
      }
      if(userId&&paid.length&&accountStatus!=="suspended"){
        const kind=accountStatus==="pending_activation"?"activation_request":"access_given";
        await enqueueEmail(kind,userId,purchase.customer.email,process.env.APP_BASE_URL+"/login",event.source+":"+purchase.id+":"+kind,client);
      }
      await client.query("INSERT INTO audit_log(action,target,reason) VALUES('purchase_processed',$1,$2)",[event.source+":"+purchase.id,event.type]);
      return finish(review?"review_required":"processed",review?"partial_refund":"completed");
    });
  }catch{
    if(jobId)await query("UPDATE webhook_event SET status='failed',attempts=attempts+1,last_error='WORKER_PROCESS_FAILED',next_attempt=now()+LEAST(3600,60*power(2,attempts))*interval '1 second' WHERE id=$1",[jobId]);
    else throw new Error("WORKER_DATABASE_UNAVAILABLE");
    return true;
  }
}

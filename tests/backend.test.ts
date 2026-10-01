import test from "node:test";
import assert from "node:assert/strict";
import {createHmac,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createServer} from "node:net";
import {sampleCalculation} from "../src/lib/hpp";
import {toApiInput} from "../src/lib/input";

const url=process.env.HPP_TEST_DATABASE_URL;
test("Backend integration: webhook, activation, access, revisions and admin", {skip:!url},async t=>{
  const dbUrl=new URL(url!);
  assert.ok(["localhost","127.0.0.1"].includes(dbUrl.hostname)&&/^\/hpp_test(?:_|$)/.test(dbUrl.pathname),"Only a local hpp_test database is allowed.");
  process.env.DATABASE_URL=url;
  process.env.APP_BASE_URL="http://localhost:3000";
  process.env.AUTH_SECRET="local-integration-test-secret-32-characters-only";
  process.env.PURCHASE_SOURCE_ID="test-source";
  process.env.ELIGIBLE_AI_FOOD_PRODUCT_IDS="ai-food";
  const secret="test-webhook-secret-at-least-32-characters";
  process.env.PURCHASE_WEBHOOK_KEYS=JSON.stringify({test:{secret,source:"test-source"}});
  delete process.env.SMTP_HOST;
  const {auth}=await import("../src/server/auth");
  const {getMigrations}=await import("better-auth/db/migration");
  const {query,getPool}=await import("../src/server/db");
  const {receivePurchase,verifyPurchaseSignature}=await import("../src/server/purchases");
  const {processOneWebhook}=await import("../src/server/worker");
  const {processOneEmail,enqueueEmail}=await import("../src/server/email");
  const {consumeAccountToken,tokenInfo,requestActivation}=await import("../src/server/account");
  const calc=await import("../src/server/calculations");
  const {requireActor,readBody,apiError,DomainError}=await import("../src/server/http");
  const authRoute=await import("../src/app/api/auth/[...all]/route");
  const adminRoute=await import("../src/app/api/admin/[area]/route");
  const calcRoute=await import("../src/app/api/calculations/route");
  const reportRoute=await import("../src/app/api/calculations/[id]/revisions/[revision]/report/route");
  const exportRoute=await import("../src/app/api/calculations/[id]/revisions/[revision]/export/route");
  const suffix=randomUUID();
  const email="buyer-"+suffix+"@example.test";
  const request=(path:string,body?:unknown,cookie?:string)=>new Request(process.env.APP_BASE_URL+path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",Origin:process.env.APP_BASE_URL!,...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const params=<T extends object>(data:T)=>({params:Promise.resolve(data)});
  const sign=(raw:Uint8Array,timestamp=String(Math.floor(Date.now()/1000)))=>new Headers({"x-hpp-key-id":"test","x-hpp-timestamp":timestamp,"x-hpp-signature":"sha256="+createHmac("sha256",secret).update(timestamp+".").update(raw).digest("hex")});
  const event=(purchaseId:string,version=1,status="paid",buyer=email)=>({
    schema_version:"1",event_id:randomUUID(),source:"test-source",type:status==="paid"?"purchase.paid":status==="chargeback"?"purchase.chargeback":"purchase.refunded",occurred_at:new Date().toISOString(),
    purchase:{id:purchaseId,state_version:version,payment_status:status,currency:"IDR",amount_paid:"100000",customer:{email:buyer,name:"Pembeli uji"},items:[{id:"item-1",product_id:"ai-food",quantity:1,access_status:status}]}
  });
  const accept=async(payload:ReturnType<typeof event>)=>{const raw=Buffer.from(JSON.stringify(payload));return receivePurchase(raw,sign(raw));};
  let owner="";let cookie="";let calculationId="";let revision=0;
  try{
    await (await getMigrations(auth.options)).runMigrations();
    await query(await readFile(new URL("../db/domain.sql",import.meta.url),"utf8"));
    while(await processOneWebhook()){}
    while(await processOneEmail()){}
    await t.test("HMAC, replay window, bounded body and disabled public signup",async()=>{
      const raw=Buffer.from("{}");assert.equal(verifyPurchaseSignature(raw,sign(raw)),"test-source");
      assert.throws(()=>verifyPurchaseSignature(Buffer.from("{ }"),sign(raw)),{code:"INVALID_SIGNATURE"});
      assert.throws(()=>verifyPurchaseSignature(raw,sign(raw,String(Math.floor(Date.now()/1000)-301))),{code:"INVALID_SIGNATURE"});
      await assert.rejects(()=>readBody(new Request("http://localhost",{method:"POST",body:"x".repeat(10)}),5),{code:"BODY_TOO_LARGE"});
      assert.equal((await authRoute.POST(request("/api/auth/sign-up/email",{email,password:"test-password-123",name:"Uji"}))).status,403);
      assert.equal((await authRoute.POST(request("/api/auth/reset-password",{}))).status,403);
      assert.equal((await authRoute.POST(request("/api/auth/sign-in/email",{email,password:"x".repeat(9000)}))).status,413);
      assert.equal((await authRoute.POST(new Request(process.env.APP_BASE_URL+"/api/auth/sign-out",{method:"POST",body:"{}"}))).status,403);
      assert.equal(apiError(new DomainError(429,"RATE_LIMITED","Uji")).headers.get("retry-after"),"60");
    });
    const purchaseId="paid-"+suffix;const paid=event(purchaseId);paid.purchase.customer.email=" "+email.toUpperCase()+" ";
    await t.test("Durable inbox, duplicates and hash conflict",async()=>{
      assert.equal((await accept(paid)).status,202);assert.equal((await accept(paid)).status,200);
      await assert.rejects(()=>accept({...paid,purchase:{...paid.purchase,amount_paid:"999"}}),{code:"EVENT_CONFLICT"});
      assert.equal((await query("SELECT count(*)::int n FROM access_grant WHERE purchase_id=$1",[purchaseId])).rows[0].n,0);
      assert.equal(await processOneWebhook(),true);
      const grant=await query("SELECT g.user_id,g.status,p.account_status FROM access_grant g JOIN user_profile p ON p.user_id=g.user_id WHERE g.purchase_id=$1",[purchaseId]);
      owner=grant.rows[0].user_id;assert.equal(grant.rows[0].status,"active");assert.equal(grant.rows[0].account_status,"pending_activation");
      assert.equal((await query("SELECT count(*)::int n FROM email_outbox WHERE user_id=$1 AND kind='activation_request'",[owner])).rows[0].n,1);
      const login=await authRoute.POST(request("/api/auth/sign-in/email",{email,password:"test-password-123"}));assert.notEqual(login.status,200);
    });
    await t.test("Activation is one-use, GET does not consume, SMTP failure preserves grants",async()=>{
      assert.equal(await processOneEmail(),true);
      const outbox=await query("SELECT * FROM email_outbox WHERE user_id=$1 AND kind='activation' ORDER BY created_at DESC LIMIT 1",[owner]);
      const token=new URL(outbox.rows[0].payload.url).searchParams.get("token")!;
      assert.equal((await tokenInfo(token,"activation")).email,email);assert.equal((await tokenInfo(token,"activation")).email,email);
      await processOneEmail();
      assert.equal((await query("SELECT status,last_error FROM email_outbox WHERE id=$1",[outbox.rows[0].id])).rows[0].last_error,"SMTP_NOT_CONFIGURED");
      assert.equal((await query("SELECT status FROM access_grant WHERE purchase_id=$1",[purchaseId])).rows[0].status,"active");
      await consumeAccountToken(token,"test-password-123","activation");
      await assert.rejects(()=>consumeAccountToken(token,"test-password-123","activation"),{code:"INVALID_TOKEN"});
      const login=await authRoute.POST(request("/api/auth/sign-in/email",{email,password:"test-password-123"}));
      assert.equal(login.status,200);
      cookie=login.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
      assert.equal((await requireActor(request("/api/calculations",undefined,cookie))).id,owner);
      assert.equal((await query("SELECT payload FROM email_outbox WHERE id=$1",[outbox.rows[0].id])).rows[0].payload,null);
    });
    await t.test("Draft conflict, owner isolation, finalization idempotency and immutable snapshot",async()=>{
      const input=toApiInput(sampleCalculation());const draft=await calc.createCalculation(owner,input);calculationId=draft.id;
      const newer=await calc.saveDraft(owner,draft.id,{...input,note:"Perubahan"},draft.draftVersion!);
      await assert.rejects(()=>calc.saveDraft(owner,draft.id,input,draft.draftVersion!),{code:"DRAFT_CONFLICT"});
      await assert.rejects(()=>calc.getCalculation("another-user",draft.id),{code:"NOT_FOUND"});
      const reqId=randomUUID();const final=await calc.finalizeCalculation(owner,draft.id,newer.draftVersion!,reqId);revision=final.revision;
      assert.equal((await calc.finalizeCalculation(owner,draft.id,newer.draftVersion!,reqId)).revision,revision);
      const report=await calc.getReport(owner,draft.id,revision);assert.equal(report.result.C,"10000");
      await calc.saveDraft(owner,draft.id,{...input,name:"Baru"},newer.draftVersion!);
      assert.equal((await calc.getReport(owner,draft.id,revision)).calculation.name,input.name);
      await assert.rejects(()=>query("UPDATE calculation_revision SET result='{}' WHERE calculation_id=$1",[draft.id]),/immutable/);
      const reportResponse=await reportRoute.GET(request("/api/report",undefined,cookie),params({id:draft.id,revision:String(revision)}));assert.equal(reportResponse.status,200);
      const exported=await exportRoute.GET(request("/api/export?format=pdf",undefined,cookie),params({id:draft.id,revision:String(revision)}));assert.equal(exported.status,200);assert.equal(exported.headers.get("content-type"),"application/pdf");
      const list=await calcRoute.GET(request("/api/calculations",undefined,cookie));assert.equal(list.status,200);
    });
    await t.test("Refund-before-paid, independent grants and partial refund review",async()=>{
      const refundId="refund-"+suffix;await accept(event(refundId,2,"refunded"));await processOneWebhook();await accept(event(refundId,1));await processOneWebhook();
      assert.equal((await query("SELECT status,user_id FROM access_grant WHERE purchase_id=$1",[refundId])).rows[0].status,"revoked");
      const secondId="second-"+suffix;await accept(event(secondId));await processOneWebhook();
      assert.equal((await query("SELECT user_id FROM access_grant WHERE purchase_id=$1",[secondId])).rows[0].user_id,owner);
      const partial=event(secondId,2,"partially_refunded");await accept(partial);await processOneWebhook();
      assert.equal((await query("SELECT status FROM webhook_event WHERE event_id=$1",[partial.event_id])).rows[0].status,"review_required");
      await accept(event(purchaseId,2,"refunded"));await processOneWebhook();assert.equal((await requireActor(request("/api/calculations",undefined,cookie))).id,owner);
      await accept(event(secondId,3,"chargeback"));await processOneWebhook();
      await assert.rejects(()=>requireActor(request("/api/calculations",undefined,cookie)),{code:"ACCESS_INACTIVE"});
      assert.equal((await reportRoute.GET(request("/api/report",undefined,cookie),params({id:calculationId,revision:String(revision)}))).status,403);
      assert.equal((await exportRoute.GET(request("/api/export?format=xlsx",undefined,cookie),params({id:calculationId,revision:String(revision)}))).status,403);
      assert.ok((await query("SELECT 1 FROM calculation WHERE id=$1",[calculationId])).rowCount);
    });
    await t.test("Changed email, noneligible products and retry safety",async()=>{
      const changed=event(purchaseId,3,"paid","changed-"+suffix+"@example.test");await accept(changed);await processOneWebhook();
      assert.equal((await query("SELECT stage FROM webhook_event WHERE event_id=$1",[changed.event_id])).rows[0].stage,"email_changed");
      const ignored=event("ignored-"+suffix);ignored.purchase.items[0].product_id="other";await accept(ignored);await processOneWebhook();
      assert.equal((await query("SELECT stage FROM webhook_event WHERE event_id=$1",[ignored.event_id])).rows[0].stage,"ignored_product");
      assert.equal((await query("SELECT count(*)::int n FROM access_grant WHERE purchase_id=$1",[ignored.purchase.id])).rows[0].n,0);
      await accept({...paid,event_id:randomUUID()});await processOneWebhook();
      assert.equal((await query("SELECT count(*)::int n FROM email_outbox WHERE user_id=$1 AND kind='activation_request'",[owner])).rows[0].n,1);
      const conflict=event(purchaseId,2,"paid");await accept(conflict);await processOneWebhook();
      assert.equal((await query("SELECT stage FROM webhook_event WHERE event_id=$1",[conflict.event_id])).rows[0].stage,"version_conflict");
      assert.equal((await query("SELECT status FROM access_grant WHERE purchase_id=$1",[purchaseId])).rows[0].status,"revoked");
    });
    await t.test("Admin authorization, reasons and audited restore/revoke",async()=>{
      assert.equal((await adminRoute.GET(request("/api/admin/access",undefined,cookie),params({area:"access"}))).status,403);
      const created=await auth.api.createUser({body:{email:"admin-"+suffix+"@example.test",name:"Admin uji",password:"admin-password-123",role:"admin"}});
      await query("INSERT INTO user_profile(user_id,account_status,role) VALUES($1,'active','admin')",[created.user.id]);
      const login=await authRoute.POST(request("/api/auth/sign-in/email",{email:created.user.email,password:"admin-password-123"}));
      assert.equal(login.status,200);const adminCookie=login.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
      const grant=(await query("SELECT id FROM access_grant WHERE purchase_id=$1",[purchaseId])).rows[0].id;
      assert.equal((await adminRoute.POST(request("/api/admin/access",{action:"restore",id:grant,reason:""},adminCookie),params({area:"access"}))).status,422);
      assert.equal((await adminRoute.POST(request("/api/admin/access",{action:"restore",id:grant,reason:"Koreksi administrasi"},adminCookie),params({area:"access"}))).status,200);
      assert.equal((await requireActor(request("/api/calculations",undefined,cookie))).id,owner);
      assert.equal((await adminRoute.POST(request("/api/admin/access",{action:"revoke",id:grant,reason:"Pembelian dibatalkan"},adminCookie),params({area:"access"}))).status,200);
      assert.equal((await query("SELECT count(*)::int n FROM audit_log WHERE actor_id=$1",[created.user.id])).rows[0].n,2);
      const listing=await adminRoute.GET(request("/api/admin/access",undefined,adminCookie),params({area:"access"}));assert.equal(listing.status,200);
      const text=await listing.text();assert.ok(!text.includes("draft_input")&&!text.includes("password"));
    });
    await t.test("Reset revokes sessions; activation resend invalidates old links",async()=>{
      await auth.api.requestPasswordReset({body:{email,redirectTo:process.env.APP_BASE_URL+"/reset-password"}});
      const reset=(await query("SELECT payload FROM email_outbox WHERE user_id=$1 AND kind='password_reset' ORDER BY created_at DESC LIMIT 1",[owner])).rows[0];
      const token=new URL(reset.payload.url).searchParams.get("token")!;await consumeAccountToken(token,"changed-password-123","password_reset");
      await assert.rejects(()=>requireActor(request("/api/profile",undefined,cookie),"session"),{code:"UNAUTHENTICATED"});
      const pending=await auth.api.createUser({body:{email:"pending-"+suffix+"@example.test",name:"Pending"}});
      await query("INSERT INTO user_profile(user_id) VALUES($1)",[pending.user.id]);await requestActivation(pending.user.id);
      const old=(await query("SELECT payload FROM email_outbox WHERE user_id=$1 AND kind='activation' ORDER BY created_at DESC LIMIT 1",[pending.user.id])).rows[0];
      const oldToken=new URL(old.payload.url).searchParams.get("token")!;await requestActivation(pending.user.id);
      await assert.rejects(()=>tokenInfo(oldToken,"activation"),{code:"INVALID_TOKEN"});
    });
    await t.test("SMTP success clears secret payload and retention expires failed emails",async()=>{
      while(await processOneEmail()){}
      let received="";
      const smtp=createServer(socket=>{
        socket.write("220 localhost test SMTP\r\n");let buffer="";let dataMode=false;
        socket.on("data",chunk=>{
          buffer+=chunk.toString();
          let boundary:number;
          while((boundary=buffer.indexOf("\r\n"))>=0){
            const line=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
            if(dataMode){if(line==="."){dataMode=false;socket.write("250 delivered\r\n");}else received+=line+"\n";continue;}
            if(/^EHLO/.test(line))socket.write("250-localhost\r\n250 PIPELINING\r\n");
            else if(/^DATA/.test(line)){dataMode=true;socket.write("354 data\r\n");}
            else if(/^QUIT/.test(line)){socket.end("221 bye\r\n");}
            else socket.write("250 ok\r\n");
          }
        });
      });
      await new Promise<void>(resolve=>smtp.listen(0,"127.0.0.1",resolve));
      process.env.SMTP_HOST="127.0.0.1";process.env.SMTP_PORT=String((smtp.address() as {port:number}).port);process.env.EMAIL_FROM="hpp@example.test";
      try{
        const dedup="smtp-test:"+suffix;await enqueueEmail("access_given",owner,email,process.env.APP_BASE_URL+"/login",dedup);
        await processOneEmail();const job=(await query("SELECT status,payload FROM email_outbox WHERE dedup_key=$1",[dedup])).rows[0];
        assert.equal(job.status,"sent");assert.equal(job.payload,null);assert.ok(received.includes("Akses Kalkulator"));
        const expired="expired:"+suffix;await query("INSERT INTO email_outbox(user_id,kind,recipient,dedup_key,payload,expires_at,status,attempts) VALUES($1,'activation',$2,$3,$4,now()-interval '1 hour','failed',10)",[owner,email,expired,JSON.stringify({url:"secret-test-link"})]);
        const {maintainRetention}=await import("../src/server/maintenance");await maintainRetention();
        const cleared=(await query("SELECT status,payload FROM email_outbox WHERE dedup_key=$1",[expired])).rows[0];assert.equal(cleared.status,"expired");assert.equal(cleared.payload,null);
      }finally{delete process.env.SMTP_HOST;await new Promise<void>((resolve,reject)=>smtp.close(error=>error?reject(error):resolve()));}
    });
  }finally{await getPool().end();}
});

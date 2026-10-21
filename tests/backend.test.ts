import test from "node:test";
import assert from "node:assert/strict";
import {createHmac,randomUUID} from "node:crypto";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
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
  delete process.env.SMTP_REQUIRE_TLS;
  delete process.env.SMTP_SECURE;
  const {auth}=await import("../src/server/auth");
  const {getMigrations}=await import("better-auth/db/migration");
  const {query,getPool}=await import("../src/server/db");
  const {receivePurchase,verifyPurchaseSignature}=await import("../src/server/purchases");
  const {processOneWebhook}=await import("../src/server/worker");
  const {processOneEmail,enqueueEmail}=await import("../src/server/email");
  const {consumeAccountToken,tokenInfo,requestActivation}=await import("../src/server/account");
  const calc=await import("../src/server/calculations");
  const {listPromptGallery}=await import("../src/server/prompt-gallery");
  const {requireActor,readBody,apiError,DomainError}=await import("../src/server/http");
  const authRoute=await import("../src/app/api/auth/[...all]/route");
  const adminRoute=await import("../src/app/api/admin/[area]/route");
  const promptAdminRoute=await import("../src/app/api/admin/prompt-gallery/route");
  const promptCardsRoute=await import("../src/app/api/admin/prompt-gallery/cards/route");
  const promptCardRoute=await import("../src/app/api/admin/prompt-gallery/cards/[id]/route");
  const promptAdminImageRoute=await import("../src/app/api/admin/prompt-gallery/cards/[id]/image/route");
  const calcRoute=await import("../src/app/api/calculations/route");
  const reportRoute=await import("../src/app/api/calculations/[id]/revisions/[revision]/report/route");
  const channelsRoute=await import("../src/app/api/calculations/[id]/channels/route");
  const salesDayRoute=await import("../src/app/api/sales/day/route");
  const salesAnalysisRoute=await import("../src/app/api/sales/analysis/route");
  const profileRoute=await import("../src/app/api/profile/route");
  const guideRoute=await import("../src/app/api/profile/guide/route");
  const ingredientRoute=await import("../src/app/api/ingredients/route");
  const ingredientPriceRoute=await import("../src/app/api/ingredients/[id]/route");
  const ingredientPreviewRoute=await import("../src/app/api/ingredients/[id]/preview/route");
  const ingredients=await import("../src/server/ingredients");
  const sales=await import("../src/server/sales");
  const exportRoute=await import("../src/app/api/calculations/[id]/revisions/[revision]/export/route");
  const suffix=randomUUID();
  const promptProductId="ai-prompt-"+suffix;
  process.env.PROMPT_GALLERY_PRODUCT_IDS=promptProductId;
  const email="buyer-"+suffix+"@example.test";
  const request=(path:string,body?:unknown,cookie?:string)=>new Request(process.env.APP_BASE_URL+path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",Origin:process.env.APP_BASE_URL!,...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const params=<T extends object>(data:T)=>({params:Promise.resolve(data)});
  const sign=(raw:Uint8Array,timestamp=String(Math.floor(Date.now()/1000)))=>new Headers({"x-hpp-key-id":"test","x-hpp-timestamp":timestamp,"x-hpp-signature":"sha256="+createHmac("sha256",secret).update(timestamp+".").update(raw).digest("hex")});
  const event=(purchaseId:string,version=1,status="paid",buyer=email)=>({
    schema_version:"1",event_id:randomUUID(),source:"test-source",type:status==="paid"?"purchase.paid":status==="chargeback"?"purchase.chargeback":"purchase.refunded",occurred_at:new Date().toISOString(),
    purchase:{id:purchaseId,state_version:version,payment_status:status,currency:"IDR",amount_paid:"100000",customer:{email:buyer,name:"Pembeli uji"},items:[{id:"item-1",product_id:"ai-food",quantity:1,access_status:status}]}
  });
  const accept=async(payload:ReturnType<typeof event>)=>{const raw=Buffer.from(JSON.stringify(payload));return receivePurchase(raw,sign(raw));};
  let owner="";let cookie="";let adminCookie="";let calculationId="";let revision=0;
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
    await t.test("Customer guide appears before completion and stays completed per account",async()=>{
      const initial=await profileRoute.GET(request("/api/profile",undefined,cookie));
      assert.equal((await initial.json()).guideCompletedAt,null);
      assert.equal((await guideRoute.POST(request("/api/profile/guide",{}))).status,401);
      const complete=await guideRoute.POST(request("/api/profile/guide",{},cookie));
      assert.equal(complete.status,200);
      const first=(await complete.json()).guideCompletedAt;
      assert.ok(first);
      assert.equal((await (await guideRoute.POST(request("/api/profile/guide",{},cookie))).json()).guideCompletedAt,first);
      assert.equal((await (await profileRoute.GET(request("/api/profile",undefined,cookie))).json()).guideCompletedAt,first);
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
    await t.test("Daily sales preserve historical HPP, separate orders from units, and enforce version/owner",async()=>{
      const date=(await import("../src/lib/sales")).businessToday();
      const salesDraft=await calc.createCalculation(owner,toApiInput(sampleCalculation()));
      const salesCalculationId=salesDraft.id;
      await calc.finalizeCalculation(owner,salesCalculationId,salesDraft.draftVersion!,randomUUID());
      const input={date,version:0,note:"Uji penjualan",channels:[{channel:"GoFood",orders:2,deductions:"5000",items:[{calculationId:salesCalculationId,quantity:3,gross:"45000"}]}]};
      const saved=await sales.saveSalesDay(owner,input);
      assert.equal(saved.channels[0].items[0].unitCost,"10000");
      assert.equal(saved.channels[0].items[0].revision,1);
      assert.equal((await sales.salesAnalysis(owner,date,date)).current.total.orders,2);
      assert.equal((await sales.salesAnalysis(owner,date,date)).current.total.units,3);
      assert.equal((await sales.salesAnalysis(owner,date,date)).current.total.contribution,"10000.00");
      assert.equal(await sales.getSalesDay("another-user",date),null);
      await assert.rejects(()=>sales.saveSalesDay(owner,input),{code:"SALES_DAY_CONFLICT"});
      const current=await calc.getCalculation(owner,salesCalculationId);
      const changed=await calc.saveDraft(owner,salesCalculationId,{...toApiInput(sampleCalculation()),ingredients:[
        {...toApiInput(sampleCalculation()).ingredients[0],price:"20000"},
        ...toApiInput(sampleCalculation()).ingredients.slice(1),
      ]},current.draftVersion!);
      await calc.finalizeCalculation(owner,salesCalculationId,changed.draftVersion!,randomUUID());
      const edited=await sales.saveSalesDay(owner,{...input,version:1,note:"Diperbaiki",channels:[{...input.channels[0],items:[{calculationId:salesCalculationId,quantity:4,gross:"60000"}]}]});
      assert.equal(edited.channels[0].items[0].unitCost,"10000");
      assert.equal(edited.channels[0].items[0].revision,1);
      assert.equal((await sales.salesAnalysis(owner,date,date)).current.total.cost,"40000.00");
      assert.equal((await salesDayRoute.GET(request(`/api/sales/day?date=${date}`,undefined,cookie))).status,200);
      assert.equal((await salesAnalysisRoute.GET(request(`/api/sales/analysis?from=${date}&to=${date}`,undefined,cookie))).status,200);
      assert.equal((await salesDayRoute.GET(request(`/api/sales/day?date=${date}`))).status,401);
    });
    await t.test("Linked ingredient prices update active recipes while preserving old revisions and sales",async()=>{
      assert.equal((await ingredientRoute.GET(request("/api/ingredients"))).status,401);
      const created=await ingredients.createIngredient(owner,{name:"Tepung bersama",unit:"kg",price:"15000"});
      assert.equal((await ingredients.listIngredients("another-user")).length,0);
      await assert.rejects(()=>ingredients.getIngredient("another-user",created.id),{code:"NOT_FOUND"});
      const first=toApiInput(sampleCalculation());first.name="Produk pertama";
      first.ingredients[0].catalogId=created.id;
      const second=toApiInput(sampleCalculation());second.name="Produk kedua";
      second.ingredients[0]={...second.ingredients[0],unit:"g",quantity:"1000",price:"15",catalogId:created.id};
      const draft1=await calc.createCalculation(owner,first);
      const draft2=await calc.createCalculation(owner,second);
      const draft3=await calc.createCalculation(owner,{...first,name:"Produk masih draft"});
      const archived=await calc.createCalculation(owner,{...first,name:"Produk arsip"});
      await query("UPDATE calculation SET archived=true WHERE id=$1",[archived.id]);
      await assert.rejects(()=>calc.createCalculation(owner,{...first,ingredients:[{...first.ingredients[0],catalogId:randomUUID()}]}),{code:"INVALID_INGREDIENT_LINK"});
      await calc.finalizeCalculation(owner,draft1.id,draft1.draftVersion!,randomUUID());
      await calc.finalizeCalculation(owner,draft2.id,draft2.draftVersion!,randomUUID());
      const oldReport=await calc.getReport(owner,draft1.id,1);
      const date=new Date(Date.parse((await import("../src/lib/sales")).businessToday()+"T00:00:00Z")-86400000).toISOString().slice(0,10);
      const oldSale=await sales.saveSalesDay(owner,{date,version:0,note:"Sebelum harga berubah",channels:[{channel:"Langsung",orders:1,deductions:"0",items:[{calculationId:draft1.id,quantity:1,gross:"15000"}]}]});
      const preview=await ingredients.previewIngredientPrice(owner,created.id,{price:"18000",expectedVersion:1});
      assert.equal(preview.impacts.length,3);
      assert.ok(preview.impacts.every(item=>Number(item.updatedCost)-Number(item.previousCost)===300));
      assert.equal((await ingredientPreviewRoute.POST(request(`/api/ingredients/${created.id}/preview`,{price:"18000",expectedVersion:1},cookie),params({id:created.id}))).status,200);
      const applied=await ingredients.applyIngredientPrice(owner,created.id,{price:"18000",expectedVersion:1,
        recipeVersions:preview.impacts.map(item=>({id:item.id,version:item.draftVersion}))});
      assert.equal(applied.updatedRecipes.length,3);
      assert.equal(applied.ingredient.version,2);
      assert.equal((await calc.getReport(owner,draft1.id,1)).result.C,oldReport.result.C);
      const newReport=await calc.getReport(owner,draft1.id,2);
      assert.equal(Number(newReport.result.C)-Number(oldReport.result.C),300);
      assert.equal(newReport.result.effective,oldReport.result.effective);
      assert.equal((await calc.getReport(owner,draft2.id,2)).input.ingredients[0].price,"18");
      assert.equal((await calc.getCalculation(owner,draft3.id)).ingredients[0].price,"18000");
      assert.equal((await calc.getCalculation(owner,draft3.id)).revision,0);
      assert.equal((await calc.getCalculation(owner,archived.id)).ingredients[0].price,"15000");
      assert.equal((await sales.getSalesDay(owner,date))!.channels[0].items[0].unitCost,oldSale.channels[0].items[0].unitCost);
      assert.equal((await ingredients.getIngredient(owner,created.id)).history.length,2);
      await assert.rejects(()=>ingredients.applyIngredientPrice(owner,created.id,{price:"19000",expectedVersion:1,recipeVersions:[]}),{code:"INGREDIENT_CONFLICT"});
      const stale=await ingredients.previewIngredientPrice(owner,created.id,{price:"19000",expectedVersion:2});
      const edited=await calc.getCalculation(owner,draft1.id);
      await calc.saveDraft(owner,draft1.id,{...toApiInput(edited),note:"Sedang diedit"},edited.draftVersion!);
      await assert.rejects(()=>ingredients.applyIngredientPrice(owner,created.id,{price:"19000",expectedVersion:2,
        recipeVersions:stale.impacts.map(item=>({id:item.id,version:item.draftVersion}))}),{code:"RECIPE_CONFLICT"});
      assert.equal((await ingredients.getIngredient(owner,created.id)).ingredient.version,2);
      assert.equal((await ingredientPriceRoute.GET(request(`/api/ingredients/${created.id}`,undefined,cookie),params({id:created.id}))).status,200);
    });
    await t.test("Prompt gallery uses its own purchase entitlement and product ID",async()=>{
      const actor=await requireActor(request("/api/profile",undefined,cookie),"session");
      await query("INSERT INTO prompt_gallery_collection(product_id,name) VALUES($1,'Koleksi uji')",[promptProductId]);
      await query("INSERT INTO prompt_gallery_card(id,product_id,title,group_name,type_name,prompt_text,image_key,image_mime) VALUES($1,$2,'Prompt uji','FOOD','Studio','Buat foto produk makanan dengan pencahayaan studio yang lembut.',$3,'image/jpeg')",["card-"+suffix,promptProductId,"a".repeat(64)+".jpg"]);
      assert.equal((await listPromptGallery(actor)).collections.length,0);
      const promptPurchase=event("prompt-"+suffix);promptPurchase.purchase.items[0].product_id=promptProductId;
      await accept(promptPurchase);await processOneWebhook();
      assert.equal((await query("SELECT feature_key FROM access_grant WHERE purchase_id=$1",[promptPurchase.purchase.id])).rows[0].feature_key,"prompt_gallery");
      assert.equal((await listPromptGallery(actor)).collections[0].cards.length,1);
      const promptRefund=event(promptPurchase.purchase.id,2,"refunded");promptRefund.purchase.items[0].product_id=promptProductId;
      await accept(promptRefund);await processOneWebhook();
      assert.equal((await listPromptGallery(actor)).collections.length,0);
    });
    await t.test("Channel prices load HPP and persist merchant-specific fees",async()=>{
      const path=`/api/calculations/${calculationId}/channels`;
      const initial=await channelsRoute.GET(request(path,undefined,cookie),params({id:calculationId}));
      assert.equal(initial.status,200);
      const body=await initial.json();
      assert.equal(body.calculation.costPerUnit,"10000");
      const settings=[{...body.settings[0],commissionRate:"20",fixedFee:"1000",extraCost:"2000"}];
      const put=new Request(process.env.APP_BASE_URL+path,{method:"PUT",headers:{"Content-Type":"application/json",Origin:process.env.APP_BASE_URL!,Cookie:cookie},body:JSON.stringify({settings})});
      assert.equal((await channelsRoute.PUT(put,params({id:calculationId}))).status,200);
      const saved=await channelsRoute.GET(request(path,undefined,cookie),params({id:calculationId}));
      assert.equal((await saved.json()).settings[0].commissionRate,"20");
      const bad=new Request(process.env.APP_BASE_URL+path,{method:"PUT",headers:{"Content-Type":"application/json",Origin:process.env.APP_BASE_URL!,Cookie:cookie},body:JSON.stringify({settings:[{...settings[0],commissionRate:"100"}]})});
      assert.equal((await channelsRoute.PUT(bad,params({id:calculationId}))).status,422);
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
      assert.equal(login.status,200);adminCookie=login.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
      const grant=(await query("SELECT id FROM access_grant WHERE purchase_id=$1",[purchaseId])).rows[0].id;
      assert.equal((await adminRoute.POST(request("/api/admin/access",{action:"restore",id:grant,reason:""},adminCookie),params({area:"access"}))).status,422);
      assert.equal((await adminRoute.POST(request("/api/admin/access",{action:"restore",id:grant,reason:"Koreksi administrasi"},adminCookie),params({area:"access"}))).status,200);
      assert.equal((await requireActor(request("/api/calculations",undefined,cookie))).id,owner);
      assert.equal((await adminRoute.POST(request("/api/admin/access",{action:"revoke",id:grant,reason:"Pembelian dibatalkan"},adminCookie),params({area:"access"}))).status,200);
      assert.equal((await query("SELECT count(*)::int n FROM audit_log WHERE actor_id=$1",[created.user.id])).rows[0].n,2);
      const listing=await adminRoute.GET(request("/api/admin/access",undefined,adminCookie),params({area:"access"}));assert.equal(listing.status,200);
      const text=await listing.text();assert.ok(!text.includes("draft_input")&&!text.includes("password"));
    });
    await t.test("Admin can create, edit, preview and delete private prompt cards",async()=>{
      const promptRoot=await mkdtemp(join(tmpdir(),"hpp-admin-prompts-"));
      process.env.PROMPT_MEDIA_ROOT=promptRoot;
      try{
        const adminProduct="admin-prompt-"+suffix;
        const collection={productId:adminProduct,name:"Koleksi admin uji",description:"Deskripsi uji"};
        assert.equal((await promptAdminRoute.POST(request("/api/admin/prompt-gallery",collection,cookie))).status,403);
        assert.equal((await promptAdminRoute.POST(request("/api/admin/prompt-gallery",collection,adminCookie))).status,201);
        const fields=new FormData();fields.set("productId",adminProduct);fields.set("title","Foto menu uji");
        fields.set("group","FOOD");fields.set("typeName","Studio");fields.set("promptText","Buat foto produk makanan dengan pencahayaan studio yang lembut.");
        fields.set("usageTips","Pakai cahaya lembut.");fields.set("sortOrder","1");fields.set("active","true");
        const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pFYAAAAASUVORK5CYII=","base64");
        fields.set("image",new Blob([png],{type:"image/png"}),"contoh.png");
        const multipart=(method:"POST"|"PATCH",path:string,form:FormData,selectedCookie=adminCookie)=>new Request(process.env.APP_BASE_URL+path,{method,headers:{Origin:process.env.APP_BASE_URL!,Cookie:selectedCookie},body:form});
        assert.equal((await promptCardsRoute.POST(multipart("POST","/api/admin/prompt-gallery/cards",fields,cookie))).status,403);
        const created=await promptCardsRoute.POST(multipart("POST","/api/admin/prompt-gallery/cards",fields));
        assert.equal(created.status,201);const card=(await created.json()).card;
        assert.equal(card.title,"Foto menu uji");
        const listed=await promptAdminRoute.GET(request("/api/admin/prompt-gallery?productId="+adminProduct,undefined,adminCookie));
        assert.equal((await listed.json()).cards.length,1);
        const imagePath=`/api/admin/prompt-gallery/cards/${card.id}/image`;
        assert.equal((await promptAdminImageRoute.GET(request(imagePath,undefined,adminCookie),params({id:card.id}))).headers.get("content-type"),"image/png");
        assert.equal((await promptAdminImageRoute.GET(request(imagePath,undefined,cookie),params({id:card.id}))).status,403);
        fields.delete("image");fields.set("active","false");
        const updated=await promptCardRoute.PATCH(multipart("PATCH",`/api/admin/prompt-gallery/cards/${card.id}`,fields),params({id:card.id}));
        assert.equal((await updated.json()).card.active,false);
        const deleted=await promptCardRoute.DELETE(new Request(process.env.APP_BASE_URL+`/api/admin/prompt-gallery/cards/${card.id}`,{method:"DELETE",headers:{Origin:process.env.APP_BASE_URL!,Cookie:adminCookie}}),params({id:card.id}));
        assert.equal(deleted.status,200);
      }finally{delete process.env.PROMPT_MEDIA_ROOT;await rm(promptRoot,{recursive:true,force:true});}
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
        assert.equal(job.status,"sent");assert.equal(job.payload,null);assert.ok(received.includes("Akses KulinerKit"));
        const expired="expired:"+suffix;await query("INSERT INTO email_outbox(user_id,kind,recipient,dedup_key,payload,expires_at,status,attempts) VALUES($1,'activation',$2,$3,$4,now()-interval '1 hour','failed',10)",[owner,email,expired,JSON.stringify({url:"secret-test-link"})]);
        const {maintainRetention}=await import("../src/server/maintenance");await maintainRetention();
        const cleared=(await query("SELECT status,payload FROM email_outbox WHERE dedup_key=$1",[expired])).rows[0];assert.equal(cleared.status,"expired");assert.equal(cleared.payload,null);
      }finally{delete process.env.SMTP_HOST;await new Promise<void>((resolve,reject)=>smtp.close(error=>error?reject(error):resolve()));}
    });
  }finally{await getPool().end();}
});

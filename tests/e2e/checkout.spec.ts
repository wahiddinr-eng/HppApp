import { test,expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

test.skip(!process.env.HPP_TEST_DATABASE_URL,"A local hpp_test database is required.");
test("Direct checkout shows sale price, WhatsApp confirmation, and admin completion",async({page})=>{
  const dbUrl=new URL(process.env.HPP_TEST_DATABASE_URL!);
  expect(["localhost","127.0.0.1"]).toContain(dbUrl.hostname);
  expect(dbUrl.pathname).toMatch(/^\/hpp_test(?:_|$)/);
  const {auth}=await import("../../src/server/auth");
  const {query}=await import("../../src/server/db");
  const {getMigrations}=await import("better-auth/db/migration");
  const email=`checkout-browser-${randomUUID()}@example.test`;
  const adminEmail=`checkout-admin-${randomUUID()}@example.test`;
  const password="checkout-browser-password-123";
  const metaEnabled=process.env.META_TRACKING_ENABLED==="true";
  const observedMeta:{name:string;eventId:string}[]=[];
  if(metaEnabled){
    await page.route("https://connect.facebook.net/**",route=>route.abort());
    page.on("request",request=>{if(request.url().endsWith("/api/meta/events")&&request.method()==="POST")observedMeta.push(request.postDataJSON());});
  }
  try{
    await (await getMigrations(auth.options)).runMigrations();
    await query(await readFile(new URL("../../db/domain.sql",import.meta.url),"utf8"));
    await query("UPDATE checkout_settings SET price=125000,compare_price=299000,enabled=true,bank_name='Bank Uji',account_number='123456789',account_holder='KulinerKit Uji' WHERE id=1");
    const admin=await auth.api.createUser({body:{email:adminEmail,password,name:"Admin checkout",role:"admin"}});
    await query("INSERT INTO user_profile(user_id,account_status,role) VALUES($1,'active','admin')",[admin.user.id]);
    await page.goto("/");
    await expect(page.locator("del").filter({hasText:"Rp299.000"})).toBeVisible();
    await expect(page.getByText("Rp125.000",{exact:true}).first()).toBeVisible();
    if(metaEnabled){
      await expect.poll(()=>observedMeta.some(event=>event.name==="ViewContent")).toBe(true);
      const browserId=await page.evaluate(()=>(window as any).fbq?.queue?.find((args:unknown[])=>args[2]==="ViewContent")?.[4]?.eventID);
      expect(browserId).toBe(observedMeta.find(event=>event.name==="ViewContent")?.eventId);
    }
    await page.getByRole("link",{name:"Beli akses KulinerKit"}).click();
    await expect(page).toHaveURL(/\/checkout$/);
    if(metaEnabled){
      await expect.poll(()=>observedMeta.some(event=>event.name==="InitiateCheckout")).toBe(true);
      const browserId=await page.evaluate(()=>(window as any).fbq?.queue?.find((args:unknown[])=>args[2]==="InitiateCheckout")?.[4]?.eventID);
      expect(browserId).toBe(observedMeta.find(event=>event.name==="InitiateCheckout")?.eventId);
      await expect.poll(async()=>Number((await query("SELECT count(*)::int n FROM meta_event_outbox WHERE event_id=ANY($1::text[])",[observedMeta.map(event=>event.eventId)])).rows[0].n)).toBe(2);
    }
    await page.getByLabel("Nama lengkap").fill("Pembeli Browser");
    await page.getByLabel("Email aktif").fill(email);
    await page.getByLabel("Nomor WhatsApp aktif").fill("081234567890");
    await page.getByRole("button",{name:"Lanjut ke pembayaran"}).click();
    await expect(page).toHaveURL(/\/pay\/[a-f0-9]{64}$/);
    const paymentUrl=page.url();
    await expect(page.getByText("Menunggu verifikasi pembayaran")).toBeVisible();
    await expect(page.getByText("123456789",{exact:true})).toBeVisible();
    await expect(page.getByText("+6281234567890",{exact:true})).toBeVisible();
    const code=(await page.getByText(/^KK-[A-F0-9]{12}$/).first().textContent())!;
    const whatsapp=page.getByRole("link",{name:"Konfirmasi via WhatsApp"});
    await expect(whatsapp).toHaveAttribute("href",/wa\.me\/6285161218257/);
    const href=await whatsapp.getAttribute("href");
    expect(decodeURIComponent(href!)).toContain(code);
    expect(decodeURIComponent(href!)).toContain(email);
    expect(decodeURIComponent(href!)).toContain("+6281234567890");
    expect(decodeURIComponent(href!)).toContain("Rp125.000");
    await page.goto("/login");
    await page.getByLabel("Alamat email").fill(adminEmail);
    await page.getByLabel("Password",{exact:true}).fill(password);
    await page.getByRole("button",{name:"Masuk",exact:true}).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/checkout");
    await expect(page.getByRole("spinbutton",{name:"Harga jual (Rp)"})).toHaveValue("125000");
    await expect(page.getByRole("spinbutton",{name:"Harga coret (Rp)"})).toHaveValue("299000");
    await expect(page.getByRole("checkbox",{name:/Buka checkout langsung/})).toBeChecked();
    if(metaEnabled){
      await page.goto("/admin/meta");
      await expect(page.getByRole("heading",{name:"Meta Pixel & CAPI"})).toBeVisible();
      await expect(page.getByLabel("Pixel ID")).toHaveValue("123456789012345");
      await page.getByLabel("Access token CAPI").fill("admin-browser-test-token");
      await page.getByLabel(/Kode tes event/).fill("TEST-KK-BROWSER");
      await page.getByRole("button",{name:"Simpan pengaturan"}).click();
      await expect(page.getByRole("status")).toContainText("tersimpan");
      await page.reload();
      await expect(page.getByLabel("Access token CAPI")).toHaveValue("");
      await expect(page.getByText("Token sudah tersimpan.")).toBeVisible();
      expect(await page.getByRole("table").count()).toBe(0);
      const config=await page.request.get("/api/admin/meta");
      expect(JSON.stringify(await config.json())).not.toContain("admin-browser-test-token");
      expect((await query("SELECT capi_token_ciphertext FROM meta_settings WHERE id=1")).rows[0].capi_token_ciphertext).not.toContain("admin-browser-test-token");
    }
    await page.goto("/admin/transactions");
    await page.getByRole("textbox",{name:"Cari kode, email, atau nomor HP"}).fill(code);
    await expect(page.getByText(email)).toBeVisible();
    await page.getByRole("row").filter({hasText:code}).getByRole("button",{name:"Ubah status"}).click();
    await page.getByRole("textbox",{name:"Alasan perubahan"}).fill("Dana sudah masuk ke rekening");
    await page.getByRole("button",{name:"Simpan status"}).click();
    await expect(page.getByRole("status")).toContainText("complete");
    if(metaEnabled){
      const meta=await query("SELECT event_name,status,payload FROM meta_event_outbox WHERE order_id=(SELECT id FROM checkout_order WHERE code=$1)",[code]);
      expect(meta.rows).toHaveLength(1);
      expect(meta.rows[0].event_name).toBe("Purchase");
      expect(meta.rows[0].status).toBe("pending");
      expect(meta.rows[0].payload.custom_data.value).toBe(125000);
      expect(observedMeta.map(event=>event.name)).not.toContain("Purchase");
    }
    const grants=await query("SELECT feature_key,status FROM access_grant WHERE purchase_id=(SELECT id::text FROM checkout_order WHERE code=$1) ORDER BY feature_key",[code]);
    expect(grants.rows.map(row=>row.feature_key)).toEqual(["hpp_calculator","prompt_gallery"]);
    await page.goto(paymentUrl);
    await expect(page.getByText("Pembayaran terverifikasi")).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{
    await query("UPDATE checkout_settings SET enabled=false WHERE id=1").catch(()=>undefined);
  }
});

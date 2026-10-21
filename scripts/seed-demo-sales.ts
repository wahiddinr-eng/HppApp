// Local-only sample history for the existing demo customer. Existing days are preserved.
// Run after seed-demo-products.ts: node --env-file=.env.local --import tsx scripts/seed-demo-sales.ts
import assert from "node:assert/strict";
import { businessToday } from "../src/lib/sales";
import { getPool, query } from "../src/server/db";
import { getSalesDay, saleProducts, saveSalesDay } from "../src/server/sales";

for (const value of [process.env.DATABASE_URL, process.env.APP_BASE_URL]) {
  if (!value || !["localhost", "127.0.0.1"].includes(new URL(value).hostname))
    throw new Error("Seed ini hanya untuk aplikasi dan database lokal.");
}
try {
  const customer = await query<{ id: string }>(`SELECT u.id FROM "user" u JOIN user_profile p ON p.user_id=u.id
    WHERE u.email=$1 AND p.role='user' AND p.account_status='active'`, ["demo.customer.local@hpp.test"]);
  assert.equal(customer.rows.length, 1, "Akun customer demo lokal tidak ditemukan.");
  const owner = customer.rows[0].id;
  const catalog = await saleProducts(owner);
  const get = (name: string) => {
    const product = catalog.find(item => item.name === name);
    assert.ok(product, `Produk demo belum ada: ${name}`);
    return product;
  };
  const rice = get("Rice Bowl Ayam Crispy (Demo)");
  const brownie = get("Brownies Cokelat (Demo)");
  const coffee = get("Es Kopi Susu Gula Aren (Demo)");
  const today = businessToday();
  const summary = [];
  for (let offset = 13; offset >= 0; offset--) {
    const date = new Date(Date.parse(`${today}T00:00:00Z`) - offset * 86400000).toISOString().slice(0, 10);
    if (await getSalesDay(owner, date)) { summary.push({ date, status: "preserved" }); continue; }
    const n = 13 - offset;
    const goRice = 3 + n % 4, goCoffee = 4 + n % 3;
    const shRice = 2 + n % 3, shBrownie = 2 + n % 2;
    const waBrownie = 3 + n % 4, waCoffee = 4 + n % 5;
    const goGross = goRice * 26000 + goCoffee * 20000;
    const shGross = shRice * 28000 + shBrownie * 20000;
    await saveSalesDay(owner, { date, version: 0,
      note: "DATA DEMO: angka pesanan dan omzet ini hanya ilustrasi untuk mencoba analisis KulinerKit.",
      channels: [
        { channel: "GoFood", orders: goRice + goCoffee - 2, deductions: String(goGross * 0.2), items: [
          { calculationId: rice.id, quantity: goRice, gross: String(goRice * 26000) },
          { calculationId: coffee.id, quantity: goCoffee, gross: String(goCoffee * 20000) },
        ] },
        { channel: "ShopeeFood", orders: shRice + shBrownie - 1, deductions: String(shGross * 0.25), items: [
          { calculationId: rice.id, quantity: shRice, gross: String(shRice * 28000) },
          { calculationId: brownie.id, quantity: shBrownie, gross: String(shBrownie * 20000) },
        ] },
        { channel: "WhatsApp", orders: waBrownie + waCoffee - 2, deductions: "0", items: [
          { calculationId: brownie.id, quantity: waBrownie, gross: String(waBrownie * 15000) },
          { calculationId: coffee.id, quantity: waCoffee, gross: String(waCoffee * 15000) },
        ] },
      ],
    });
    summary.push({ date, status: "created" });
  }
  console.log(JSON.stringify({ daysCreated: summary.filter(day => day.status === "created").length,
    daysPreserved: summary.filter(day => day.status === "preserved").length,
    firstDate: summary[0].date, lastDate: summary.at(-1)!.date }));
} finally { await getPool().end(); }

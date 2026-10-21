// Local-only sample data. Re-running preserves existing products and user edits.
// Run: node --env-file=.env.local --import tsx scripts/seed-demo-products.ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { channelSettingsSchema, calculateChannelPrice, defaultChannels } from "../src/lib/channel-pricing";
import { sampleCalculation } from "../src/lib/hpp";
import { toApiInput, type CalculationInput } from "../src/lib/input";
import { parseInput, snapshotResult } from "../src/server/calculations";
import { getPool, transaction } from "../src/server/db";

const demoEmail = "demo.customer.local@hpp.test";
const note = "DATA DEMO: seluruh harga bahan dan biaya adalah ilustrasi, bukan harga pasar. " +
  "Tarif kanal pesan-antar hanya simulasi, bukan tarif resmi GoFood/ShopeeFood/GrabFood. " +
  "Asumsi satu produk per pesanan, tanpa pajak penjualan. Silakan ubah angka untuk mencoba.";
const base = toApiInput(sampleCalculation());
const common = { ...base, business: "Dapur Demo HppApp", note, manualPrice: "", taxEnabled: false };
const examples: { key: string; input: CalculationInput; total: string; hpp: string }[] = [
  {
    key: "rice-bowl-v1", total: "260000", hpp: "13000",
    input: {
      ...common, name: "Rice Bowl Ayam Crispy (Demo)", batch: "20", outputUnit: "porsi",
      margin: "35", rounding: "1000", manualPrice: "21000",
      ingredients: [
        { id: "rice", name: "Beras", quantity: "2", unit: "kg", price: "15000" },
        { id: "chicken", name: "Ayam fillet", quantity: "2.5", unit: "kg", price: "40000" },
        { id: "flour", name: "Tepung crispy", quantity: "0.5", unit: "kg", price: "14000" },
        { id: "oil", name: "Minyak goreng (alokasi terpakai)", quantity: "0.4", unit: "liter", price: "20000" },
        { id: "sauce", name: "Saus teriyaki", quantity: "0.4", unit: "kg", price: "35000" },
        { id: "seasoning", name: "Bumbu marinasi", quantity: "0.1", unit: "kg", price: "60000" },
        { id: "vegetables", name: "Sayuran pelengkap", quantity: "0.5", unit: "kg", price: "20000" },
      ],
      packages: [
        { id: "bowl", name: "Paper bowl + tutup", quantity: "20", price: "1500" },
        { id: "spoon", name: "Sendok + tisu", quantity: "20", price: "200" },
      ],
      labor: [{ id: "cook", name: "Memasak dan mengemas satu batch", people: "1", wage: "40000" }],
      others: [
        { id: "gas", type: "Gas", note: "Alokasi per batch", amount: "6000" },
        { id: "power", type: "Listrik", note: "Rice cooker per batch", amount: "3000" },
        { id: "water", type: "Air", note: "Mencuci bahan dan alat", amount: "2000" },
      ],
    },
  },
  {
    key: "brownies-v1", total: "100000", hpp: "10000",
    input: { ...common, name: "Brownies Cokelat (Demo)", margin: "30", manualPrice: "15000",
      note: `${note} Contoh brownies mengikuti angka acuan PRD, hasil 10 box mini.` },
  },
  {
    key: "iced-coffee-v1", total: "178000", hpp: "8900",
    input: {
      ...common, name: "Es Kopi Susu Gula Aren (Demo)", batch: "20", outputUnit: "cup",
      margin: "40", rounding: "500", manualPrice: "15000",
      ingredients: [
        { id: "coffee", name: "Kopi bubuk", quantity: "0.25", unit: "kg", price: "160000" },
        { id: "milk", name: "Susu UHT", quantity: "2.5", unit: "liter", price: "20000" },
        { id: "sugar", name: "Gula aren", quantity: "0.4", unit: "kg", price: "40000" },
        { id: "creamer", name: "Krimer", quantity: "0.2", unit: "kg", price: "50000" },
        { id: "water", name: "Air seduh", quantity: "1", unit: "liter", price: "1000" },
        { id: "ice", name: "Es batu", quantity: "2", unit: "kg", price: "4000" },
      ],
      packages: [
        { id: "cup", name: "Cup 250 ml + tutup", quantity: "20", price: "1000" },
        { id: "straw", name: "Sedotan", quantity: "20", price: "100" },
      ],
      labor: [{ id: "barista", name: "Meracik dan mengemas satu batch", people: "1", wage: "25000" }],
      others: [
        { id: "gas", type: "Gas", note: "Menyeduh kopi dan melarutkan gula", amount: "2000" },
        { id: "power", type: "Listrik", note: "Alokasi pendingin per batch", amount: "4000" },
      ],
    },
  },
];

try {
  for (const value of [process.env.DATABASE_URL, process.env.APP_BASE_URL]) {
    if (!value || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname)) {
      throw new Error("Seed ini hanya diizinkan untuk aplikasi dan database lokal.");
    }
  }
  const prepared = examples.map(example => {
    const input = parseInput(example.input);
    const result = snapshotResult(input);
    assert.equal(result.T, example.total);
    assert.equal(result.C, example.hpp);
    const settings = channelSettingsSchema.parse(defaultChannels(input.margin, input.rounding).map((channel, index) => ({
      ...channel, name: `${channel.name} (simulasi)`,
      commissionRate: ["20", "20", "25"][index], promoRate: ["0", "5", "0"][index],
      extraCost: "500",
    })));
    settings.forEach(setting => calculateChannelPrice(example.hpp, setting));
    return { ...example, input, result, settings };
  });
  const summary = await transaction(async client => {
    const account = await client.query(
      `SELECT u.id FROM "user" u JOIN user_profile p ON p.user_id=u.id
       WHERE u.email=$1 AND p.role='user' AND p.account_status='active'
       AND EXISTS(SELECT 1 FROM access_grant g WHERE g.user_id=u.id
         AND g.feature_key='hpp_calculator' AND g.status='active'
         AND (g.expires_at IS NULL OR g.expires_at>now()))`, [demoEmail]);
    assert.equal(account.rows.length, 1, "Akun demo customer aktif dengan akses HPP harus sudah tersedia.");
    const owner = account.rows[0].id as string;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`demo-products:${owner}`]);
    const output = [];
    for (const example of prepared) {
      const marker = `demo-products:${owner}:${example.key}`;
      const prior = await client.query(
        "SELECT target FROM audit_log WHERE actor_id=$1 AND action='demo.product.seed' AND reason=$2", [owner, marker]);
      if (prior.rows.length) {
        output.push({ name: example.input.name, id: prior.rows[0].target, status: "preserved" });
        continue;
      }
      const id = randomUUID();
      await client.query(
        `INSERT INTO calculation(id,owner_id,draft_input,name,state,latest_revision)
         VALUES($1,$2,$3,$4,'final',1)`,
        [id, owner, JSON.stringify({ schema_version: "1", ...example.input }), example.input.name]);
      await client.query(
        "INSERT INTO calculation_revision(calculation_id,revision,input,result) VALUES($1,1,$2,$3)",
        [id, JSON.stringify(example.input), JSON.stringify(example.result)]);
      await client.query(
        "INSERT INTO channel_price_settings(calculation_id,owner_id,settings) VALUES($1,$2,$3)",
        [id, owner, JSON.stringify(example.settings)]);
      await client.query(
        "INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'demo.product.seed',$2,$3)",
        [owner, id, marker]);
      output.push({ name: example.input.name, id, status: "created", batch: example.input.batch,
        total: example.total, hpp: example.hpp, sellingPrice: example.input.manualPrice,
        report: `/app/calculations/${id}/report`,
        channels: example.settings.map(setting => ({ name: setting.name, ...calculateChannelPrice(example.hpp, setting) })) });
    }
    return output;
  });
  console.log(JSON.stringify(summary, null, 2));
} finally { await getPool().end(); }

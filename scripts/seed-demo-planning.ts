// Local-only examples for the existing demo customer. Existing edits are never overwritten.
// Run after db:migrate and seed-demo-products.ts:
// node --env-file=.env.local --import tsx scripts/seed-demo-planning.ts
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { profitTargetSchema, calculateProfitTarget } from "../src/lib/profit-target";
import { parseInput, snapshotResult } from "../src/server/calculations";
import { getPool, query, transaction } from "../src/server/db";

const demoEmail = "demo.customer.local@hpp.test";
const ingredients = [
  { name: "Beras", unit: "kg", price: "15000" },
  { name: "Ayam fillet", unit: "kg", price: "40000" },
  { name: "Minyak goreng (alokasi terpakai)", unit: "liter", price: "20000" },
  { name: "Saus teriyaki", unit: "kg", price: "35000" },
  { name: "Tepung", unit: "kg", price: "15000" },
  { name: "Gula", unit: "kg", price: "20000" },
  { name: "Telur", unit: "buah", price: "2000" },
  { name: "Cokelat", unit: "kg", price: "30000" },
  { name: "Kopi bubuk", unit: "kg", price: "160000" },
  { name: "Susu UHT", unit: "liter", price: "20000" },
  { name: "Gula aren", unit: "kg", price: "40000" },
  { name: "Es batu", unit: "kg", price: "4000" },
] as const;
const products = [
  { key: "rice-bowl-v1", name: "Rice Bowl Ayam Crispy (Demo)" },
  { key: "brownies-v1", name: "Brownies Cokelat (Demo)" },
  { key: "iced-coffee-v1", name: "Es Kopi Susu Gula Aren (Demo)" },
] as const;

for (const key of ["DATABASE_URL", "APP_BASE_URL"] as const) {
  const value = process.env[key];
  assert.ok(value, `${key} harus diisi.`);
  const url = new URL(value);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "Skrip contoh ini hanya boleh dijalankan dengan aplikasi dan database lokal.");
}

try {
  const result = await transaction(async client => {
    const account = await client.query<{ id: string }>(`SELECT u.id FROM "user" u JOIN user_profile p ON p.user_id=u.id
      WHERE u.email=$1 AND p.role='user' AND p.account_status='active'
      AND EXISTS(SELECT 1 FROM access_grant g WHERE g.user_id=u.id AND g.feature_key='hpp_calculator'
        AND g.status='active' AND (g.expires_at IS NULL OR g.expires_at>now()))`, [demoEmail]);
    assert.equal(account.rows.length, 1, "Akun customer demo lokal dengan akses HPP aktif tidak ditemukan.");
    const owner = account.rows[0].id;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`demo-planning:${owner}`]);
    const targetTable = await client.query<{ name: string | null }>("SELECT to_regclass('profit_target')::text AS name");
    assert.ok(targetTable.rows[0].name, "Jalankan npm run db:migrate pada database lokal terlebih dahulu.");

    const ingredientIds = new Map<string, { id: string; unit: string; price: string }>();
    let created = 0;
    for (const ingredient of ingredients) {
      const prior = await client.query<{ id: string; unit: string; current_price: string }>(
        "SELECT id,unit,current_price::text FROM ingredient_catalog WHERE owner_id=$1 AND lower(name)=lower($2)",
        [owner, ingredient.name]);
      let item = prior.rows[0];
      if (!item) {
        const inserted = await client.query<{ id: string; unit: string; current_price: string }>(
          "INSERT INTO ingredient_catalog(owner_id,name,unit,current_price) VALUES($1,$2,$3,$4) RETURNING id,unit,current_price::text",
          [owner, ingredient.name, ingredient.unit, ingredient.price]);
        item = inserted.rows[0];
        await client.query("INSERT INTO ingredient_price_history(ingredient_id,version,price) VALUES($1,1,$2)",
          [item.id, ingredient.price]);
        created++;
      }
      ingredientIds.set(ingredient.name, { id: item.id, unit: item.unit, price: item.current_price });
    }

    const linked: string[] = [];
    const preserved: string[] = [];
    for (const product of products) {
      const marker = `demo-products:${owner}:${product.key}`;
      const found = await client.query<{ id: string; draft_input: unknown; draft_version: number;
        latest_revision: number; state: string; archived: boolean; cost: string; linked: boolean }>(
        `SELECT c.id,c.draft_input,c.draft_version,c.latest_revision,c.state,c.archived,
          r.result->>'C' AS cost,
          EXISTS(SELECT 1 FROM audit_log a WHERE a.actor_id=$1 AND a.action='demo.ingredient.link'
            AND a.target=c.id::text) AS linked
         FROM audit_log seed JOIN calculation c ON c.id::text=seed.target AND c.owner_id=seed.actor_id
         JOIN calculation_revision r ON r.calculation_id=c.id AND r.revision=c.latest_revision
         WHERE seed.actor_id=$1 AND seed.action='demo.product.seed' AND seed.reason=$2 FOR UPDATE OF c`,
        [owner, marker]);
      assert.equal(found.rows.length, 1, `Produk demo belum tersedia: ${product.name}`);
      const current = found.rows[0];
      assert.equal(current.archived, false, `Produk demo diarsipkan: ${product.name}`);
      if (current.linked) { preserved.push(product.name); continue; }
      assert.equal(current.state, "final", `Produk demo sudah diubah: ${product.name}`);
      assert.equal(current.latest_revision, 1, `Revisi produk demo sudah diubah: ${product.name}`);
      assert.equal(current.draft_version, 1, `Draft produk demo sudah diubah: ${product.name}`);
      const input = parseInput(current.draft_input);
      assert.equal(input.name, product.name);
      let count = 0;
      const updated = { ...input, ingredients: input.ingredients.map(line => {
        const catalog = ingredientIds.get(line.name);
        if (!catalog) return line;
        assert.equal(catalog.unit, line.unit, `Satuan bahan berbeda: ${line.name}`);
        assert.ok(new Decimal(catalog.price).eq(line.price), `Harga bahan ${line.name} telah diubah. Tidak mengubah resep demo.`);
        assert.ok(!line.catalogId, `Bahan ${line.name} sudah terhubung. Tidak mengubah resep demo.`);
        count++;
        return { ...line, catalogId: catalog.id };
      }) };
      assert.ok(count >= 3, `Bahan demo untuk ${product.name} tidak cocok.`);
      const snapshot = snapshotResult(updated);
      assert.equal(snapshot.C, current.cost, `HPP ${product.name} tidak boleh berubah saat tautan bahan dibuat.`);
      await client.query("INSERT INTO calculation_revision(calculation_id,revision,input,result) VALUES($1,2,$2,$3)",
        [current.id, JSON.stringify(updated), JSON.stringify(snapshot)]);
      await client.query(`UPDATE calculation SET draft_input=$2,draft_version=draft_version+1,
        latest_revision=2,updated_at=now() WHERE id=$1`,
      [current.id, JSON.stringify({ schema_version: "1", ...updated })]);
      await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'demo.ingredient.link',$2,$3)",
        [owner, current.id, `linked ${count} example ingredients without changing HPP`]);
      linked.push(product.name);
    }
    return { owner, ingredientCreated: created, ingredientPreserved: ingredients.length - created,
      productsLinked: linked, productsPreserved: preserved };
  });

  const settings = profitTargetSchema.parse({ monthlyFixedCost: "2500000", monthlyProfitGoal: "3000000", operatingDays: 26 });
  const projection = calculateProfitTarget(settings);
  const saved = await query<{ inserted: boolean }>(`WITH inserted AS (
      INSERT INTO profit_target(owner_id,settings) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING owner_id
    ) SELECT EXISTS(SELECT 1 FROM inserted) AS inserted`, [result.owner, JSON.stringify(settings)]);
  if (saved.rows[0].inserted) await query(
    "INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'demo.profit_target.seed',$1,$2)",
    [result.owner, "Illustrative monthly target; existing customer plans are preserved"]);
  console.log(JSON.stringify({ ingredientCreated: result.ingredientCreated,
    ingredientPreserved: result.ingredientPreserved, productsLinked: result.productsLinked,
    productsPreserved: result.productsPreserved,
    target: saved.rows[0].inserted ? "created" : "preserved",
    example: { monthlyFixedCost: settings.monthlyFixedCost, monthlyProfitGoal: settings.monthlyProfitGoal,
      operatingDays: settings.operatingDays, breakEvenDailyContribution: projection.breakEvenDailyContribution,
      targetDailyContribution: projection.targetDailyContribution } }, null, 2));
} finally { await getPool().end(); }

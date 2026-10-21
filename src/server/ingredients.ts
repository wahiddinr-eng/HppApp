import Decimal from "decimal.js";
import { z } from "zod";
import type { PoolClient } from "pg";
import { calculate, type Unit } from "../lib/hpp";
import { inputSchema, toFormInput } from "../lib/input";
import { changeLinkedPrice, changePriceSchema, newIngredientSchema, type CatalogIngredient } from "../lib/ingredient-pricing";
import { query, transaction } from "./db";
import { snapshotResult, type CalculationRow } from "./calculations";
import { DomainError } from "./http";

type CatalogRow = { id: string; owner_id: string; name: string; unit: Unit; current_price: string; version: number; updated_at: Date };
type HistoryRow = { version: number; price: string; changed_at: Date };
type LinkedRow = CalculationRow;
export type IngredientImpact = {
  id: string; name: string; state: "draft" | "final"; draftVersion: number;
  previousCost: string; updatedCost: string; currentPrice: string;
  previousMargin: string; updatedMargin: string; suggestedPrice: string; belowTarget: boolean;
};

function present(row: CatalogRow): CatalogIngredient {
  return { id: row.id, name: row.name, unit: row.unit, currentPrice: new Decimal(row.current_price).toFixed(), version: row.version, updatedAt: row.updated_at.toISOString() };
}
async function find(owner: string, id: string, client?: PoolClient, lock = false) {
  if (!z.uuid().safeParse(id).success) throw new DomainError(404, "NOT_FOUND", "Bahan tidak ditemukan.");
  const sql = "SELECT * FROM ingredient_catalog WHERE id=$1 AND owner_id=$2" + (lock ? " FOR UPDATE" : "");
  const result = client ? await client.query<CatalogRow>(sql, [id, owner]) : await query<CatalogRow>(sql, [id, owner]);
  if (!result.rows[0]) throw new DomainError(404, "NOT_FOUND", "Bahan tidak ditemukan.");
  return result.rows[0];
}
async function linked(owner: string, id: string, client?: PoolClient) {
  const sql = `SELECT * FROM calculation WHERE owner_id=$1 AND archived=false
    AND draft_input->'ingredients' @> $2::jsonb ORDER BY id` + (client ? " FOR UPDATE" : "");
  const values = [owner, JSON.stringify([{ catalogId: id }])];
  const result = client ? await client.query<LinkedRow>(sql, values) : await query<LinkedRow>(sql, values);
  return result.rows;
}
function impacts(rows: LinkedRow[], item: CatalogRow, price: string) {
  return rows.map(row => {
    const input = inputSchema.parse(row.draft_input);
    const before = calculate(toFormInput(input));
    const updated = changeLinkedPrice(input, item.id, price, item.unit);
    // A finalized menu keeps its currently chosen selling price. Only the suggested price changes.
    if (row.state === "final" && !updated.manualPrice) updated.manualPrice = before.effective.toFixed();
    const after = calculate(toFormInput(updated));
    const heldPrice = before.effective;
    const held = calculate({ ...toFormInput(updated), manualPrice: heldPrice.toFixed() });
    const targetMargin = /^\d+(?:\.\d+)?$/.test(input.margin) ? new Decimal(input.margin) : new Decimal(0);
    const impact: IngredientImpact = {
      id: row.id, name: row.name, state: row.state, draftVersion: row.draft_version,
      previousCost: before.C.toFixed(), updatedCost: after.C.toFixed(), currentPrice: heldPrice.toFixed(),
      previousMargin: before.actualMargin.toFixed(2), updatedMargin: held.actualMargin.toFixed(2),
      suggestedPrice: after.suggested.toFixed(), belowTarget: held.actualMargin.lt(targetMargin),
    };
    return { row, updated, impact };
  });
}
export async function listIngredients(owner: string) {
  const result = await query<CatalogRow>("SELECT * FROM ingredient_catalog WHERE owner_id=$1 ORDER BY name", [owner]);
  return result.rows.map(present);
}
export async function createIngredient(owner: string, value: unknown) {
  const parsed = newIngredientSchema.safeParse(value);
  if (!parsed.success) throw new DomainError(422, "INVALID_INGREDIENT", "Periksa nama, satuan, dan harga bahan.");
  try {
    return await transaction(async client => {
      const result = await client.query<CatalogRow>(`INSERT INTO ingredient_catalog(owner_id,name,unit,current_price)
        VALUES($1,$2,$3,$4) RETURNING *`, [owner, parsed.data.name, parsed.data.unit, parsed.data.price]);
      const row = result.rows[0];
      await client.query("INSERT INTO ingredient_price_history(ingredient_id,version,price) VALUES($1,1,$2)", [row.id, parsed.data.price]);
      return present(row);
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw new DomainError(409, "INGREDIENT_EXISTS", "Nama bahan sudah ada di daftar Anda.");
    throw error;
  }
}
export async function getIngredient(owner: string, id: string) {
  const ingredient = present(await find(owner, id));
  const history = await query<HistoryRow>(`SELECT version,price::text,changed_at FROM ingredient_price_history
    WHERE ingredient_id=$1 ORDER BY version DESC LIMIT 100`, [id]);
  return { ingredient, history: history.rows.map(row => ({ version: row.version, price: new Decimal(row.price).toFixed(), changedAt: row.changed_at.toISOString() })) };
}
export async function previewIngredientPrice(owner: string, id: string, value: unknown) {
  const parsed = changePriceSchema.safeParse(value);
  if (!parsed.success) throw new DomainError(422, "INVALID_PRICE", "Isi harga baru yang valid dan versi bahan terbaru.");
  const item = await find(owner, id);
  if (item.version !== parsed.data.expectedVersion) throw new DomainError(409, "INGREDIENT_CONFLICT", "Harga bahan berubah di tab lain. Muat ulang daftar bahan.");
  if (new Decimal(item.current_price).eq(parsed.data.price)) throw new DomainError(422, "PRICE_UNCHANGED", "Harga baru sama dengan harga saat ini.");
  let result: ReturnType<typeof impacts>;
  try { result = impacts(await linked(owner, id), item, parsed.data.price); }
  catch (error) { throw new DomainError(422, "PRICE_CONVERSION", error instanceof Error ? error.message : "Satuan harga tidak dapat dikonversi."); }
  return { ingredient: present(item), newPrice: parsed.data.price, impacts: result.map(value => value.impact) };
}
export async function applyIngredientPrice(owner: string, id: string, value: unknown) {
  const parsed = changePriceSchema.extend({ recipeVersions: z.array(z.object({ id: z.uuid(), version: z.number().int().positive() })).max(1000) }).safeParse(value);
  if (!parsed.success) throw new DomainError(422, "INVALID_PRICE", "Pratinjau harga tidak valid. Cek dampak lagi.");
  return transaction(async client => {
    const item = await find(owner, id, client, true);
    if (item.version !== parsed.data.expectedVersion) throw new DomainError(409, "INGREDIENT_CONFLICT", "Harga bahan berubah. Cek dampak lagi.");
    if (new Decimal(item.current_price).eq(parsed.data.price)) throw new DomainError(422, "PRICE_UNCHANGED", "Harga baru sama dengan harga saat ini.");
    const rows = await linked(owner, id, client);
    const expected = new Map(parsed.data.recipeVersions.map(row => [row.id, row.version]));
    if (expected.size !== rows.length || rows.some(row => expected.get(row.id) !== row.draft_version))
      throw new DomainError(409, "RECIPE_CONFLICT", "Ada resep yang berubah setelah pratinjau. Cek dampak lagi.");
    let changed: ReturnType<typeof impacts>;
    try { changed = impacts(rows, item, parsed.data.price); }
    catch (error) { throw new DomainError(422, "PRICE_CONVERSION", error instanceof Error ? error.message : "Satuan harga tidak dapat dikonversi."); }
    for (const { row, updated } of changed) {
      const nextRevision = row.latest_revision + 1;
      if (row.state === "final") {
        const snapshot = snapshotResult(updated);
        await client.query(`INSERT INTO calculation_revision(calculation_id,revision,input,result)
          VALUES($1,$2,$3,$4)`, [row.id, nextRevision, JSON.stringify(updated), JSON.stringify(snapshot)]);
      }
      await client.query(`UPDATE calculation SET draft_input=$2,draft_version=draft_version+1,
        latest_revision=$3,updated_at=now() WHERE id=$1`, [row.id, JSON.stringify({ schema_version: "1", ...updated }), row.state === "final" ? nextRevision : row.latest_revision]);
    }
    const saved = await client.query<CatalogRow>(`UPDATE ingredient_catalog SET current_price=$2,version=version+1,updated_at=now()
      WHERE id=$1 RETURNING *`, [id, parsed.data.price]);
    await client.query(`INSERT INTO ingredient_price_history(ingredient_id,version,price) VALUES($1,$2,$3)`, [id, saved.rows[0].version, parsed.data.price]);
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'ingredient.price.update',$2,$3)",
      [owner, id, `version ${item.version} to ${saved.rows[0].version}; ${rows.length} recipes`]);
    return { ingredient: present(saved.rows[0]), updatedRecipes: changed.map(value => value.impact) };
  });
}

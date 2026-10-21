import Decimal from "decimal.js";
import { z } from "zod";
import type { Unit } from "./hpp";
import type { CalculationInput } from "./input";

const units = z.enum(["g", "kg", "ml", "liter", "buah"]);
const pricePattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
export const priceText = z.string().regex(pricePattern)
  .refine(value => pricePattern.test(value) && new Decimal(value).gt(0), "Harga harus lebih dari Rp0.");
export const newIngredientSchema = z.object({
  name: z.string().trim().min(1).max(100), unit: units, price: priceText,
});
export const changePriceSchema = z.object({
  price: priceText, expectedVersion: z.number().int().positive(),
});
export type CatalogIngredient = {
  id: string; name: string; unit: Unit; currentPrice: string; version: number; updatedAt: string;
};

const group: Record<Unit, string> = { g: "mass", kg: "mass", ml: "volume", liter: "volume", buah: "count" };
const factor: Record<Unit, number> = { g: 1, kg: 1000, ml: 1, liter: 1000, buah: 1 };
export function priceForUnit(price: string, from: Unit, to: Unit): string {
  if (group[from] !== group[to]) throw new Error("Satuan bahan tidak sejenis. Hubungkan ulang bahan pada resep.");
  const converted = new Decimal(price).mul(factor[to]).div(factor[from]);
  if (converted.decimalPlaces() > 6) throw new Error("Harga per satuan memerlukan lebih dari 6 desimal. Gunakan satuan lain pada daftar bahan.");
  return converted.toFixed();
}

export function changeLinkedPrice(input: CalculationInput, catalogId: string, price: string, unit: Unit): CalculationInput {
  return {
    ...input,
    ingredients: input.ingredients.map(row => row.catalogId === catalogId
      ? { ...row, price: priceForUnit(price, unit, row.unit) }
      : row),
  };
}

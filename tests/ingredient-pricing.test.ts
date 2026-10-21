import test from "node:test";
import assert from "node:assert/strict";
import { changeLinkedPrice, newIngredientSchema, priceForUnit } from "../src/lib/ingredient-pricing";
import { sampleCalculation, calculate } from "../src/lib/hpp";
import { toApiInput, toFormInput } from "../src/lib/input";

test("harga katalog dikonversi tepat sesuai satuan resep", () => {
  assert.equal(priceForUnit("18000", "kg", "g"), "18");
  assert.equal(priceForUnit("18", "g", "kg"), "18000");
  assert.equal(priceForUnit("20000", "liter", "ml"), "20");
  assert.throws(() => priceForUnit("18000", "kg", "ml"), /tidak sejenis/);
  assert.throws(() => priceForUnit("0.000001", "kg", "g"), /6 desimal/);
});

test("perubahan harga hanya menyentuh baris resep tertaut, tanpa mengubah snapshot awal", () => {
  const recipe = sampleCalculation();
  recipe.ingredients[0].catalogId = "621da3c3-f537-43b2-94f1-d9165e553b6e";
  const input = toApiInput(recipe);
  const oldHpp = calculate(toFormInput(input)).C.toFixed();
  const updated = changeLinkedPrice(input, recipe.ingredients[0].catalogId!, "18000", "kg");
  assert.equal(input.ingredients[0].price, "15000");
  assert.equal(updated.ingredients[0].price, "18000");
  assert.equal(updated.ingredients[1].price, input.ingredients[1].price);
  assert.equal(calculate(toFormInput(updated)).C.minus(oldHpp).toFixed(), "300");
});

test("harga katalog harus positif dan memakai bentuk desimal canonical", () => {
  assert.equal(newIngredientSchema.safeParse({ name: " Tepung ", unit: "kg", price: "18000" }).success, true);
  assert.equal(newIngredientSchema.safeParse({ name: "Tepung", unit: "kg", price: "18.000" }).success, true);
  assert.equal(newIngredientSchema.safeParse({ name: "Tepung", unit: "kg", price: "0" }).success, false);
  assert.equal(newIngredientSchema.safeParse({ name: "Tepung", unit: "kg", price: "18,000" }).success, false);
});

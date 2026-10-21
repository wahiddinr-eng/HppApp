import Decimal from "decimal.js";

Decimal.set({ precision: 60, rounding: Decimal.ROUND_HALF_UP });

export type Unit = "g" | "kg" | "ml" | "liter" | "buah";
export type CostStatus = "pending" | "none" | "filled";
export type TaxMode = "exclusive" | "inclusive";
export type Ingredient = { id: string; name: string; quantity: string; unit: Unit; price: string; catalogId?: string };
export type PackageItem = { id: string; name: string; quantity: string; price: string };
export type LaborItem = { id: string; name: string; people: string; wage: string };
export type OtherItem = { id: string; type: string; note: string; amount: string };
export type Calculation = {
  id: string;
  name: string;
  business: string;
  batch: string;
  outputUnit: string;
  customUnit: string;
  note: string;
  ingredients: Ingredient[];
  packages: PackageItem[];
  labor: LaborItem[];
  others: OtherItem[];
  statuses: { packages: CostStatus; labor: CostStatus; others: CostStatus };
  taxEnabled: boolean;
  taxName: string;
  taxRate: string;
  taxMode: TaxMode;
  margin: string;
  rounding: "1" | "500" | "1000";
  manualPrice: string;
  state: "draft" | "final";
  archived: boolean;
  revision: number;
  draftVersion?: number;
  resultSnapshot?: Record<string, unknown>;
  updatedAt: string;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const today = () => new Date().toISOString();

export function blankCalculation(): Calculation {
  return {
    id: uid(), name: "", business: "", batch: "", outputUnit: "box", customUnit: "", note: "",
    ingredients: [{ id: uid(), name: "", quantity: "", unit: "kg", price: "" }],
    packages: [], labor: [], others: [], statuses: { packages: "pending", labor: "pending", others: "pending" },
    taxEnabled: false, taxName: "", taxRate: "", taxMode: "exclusive", margin: "30", rounding: "500", manualPrice: "",
    state: "draft", archived: false, revision: 0, updatedAt: today()
  };
}

export function sampleCalculation(): Calculation {
  return {
    ...blankCalculation(), id: "contoh-brownies", name: "Brownies cokelat", business: "Dapur Rasa", batch: "10", outputUnit: "box",
    ingredients: [
      { id: "b1", name: "Tepung", quantity: "1", unit: "kg", price: "15000" },
      { id: "b2", name: "Gula", quantity: "0.5", unit: "kg", price: "20000" },
      { id: "b3", name: "Telur", quantity: "10", unit: "buah", price: "2000" },
      { id: "b4", name: "Cokelat", quantity: "0.5", unit: "kg", price: "30000" },
      { id: "b5", name: "Mentega", quantity: "0.5", unit: "kg", price: "20000" }
    ],
    packages: [{ id: "k1", name: "Box", quantity: "10", price: "1000" }],
    labor: [{ id: "l1", name: "Tenaga kerja", people: "1", wage: "15000" }],
    others: [{ id: "o1", type: "Listrik", note: "", amount: "2000" }, { id: "o2", type: "Gas", note: "", amount: "3000" }],
    statuses: { packages: "filled", labor: "filled", others: "filled" },
    state: "final", revision: 1
  };
}

const zero = new Decimal(0);
const dec = (value: string) => {
  const normalized = value.replace(/\s/g, "").replace(/,/g, ".");
  return normalized && /^\d+(\.\d+)?$/.test(normalized) ? new Decimal(normalized) : zero;
};
export const parseQuantity = (value: string) => value.trim().replace(/,/g, ".");
export const parseMoney = (value: string) => value.trim().replace(/\./g, "").replace(/,/g, ".");
export const moneyInput = (value: string) => {
  const parsed = parseMoney(value);
  if (!/^\d+(\.\d+)?$/.test(parsed)) return value;
  const [whole, fraction] = parsed.split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")+(fraction?","+fraction:"");
};
function localizedDecimal(value: Decimal.Value, digits: number) {
  const fixed = new Decimal(value).toFixed(digits);
  const negative = fixed.startsWith("-");
  const [whole, decimal = ""] = (negative ? fixed.slice(1) : fixed).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = decimal.replace(/0+$/, "");
  return `${negative ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
}
export const rupiah = (value: Decimal.Value, digits = 0) => `${new Decimal(value).lt(0) ? "-" : ""}Rp${localizedDecimal(new Decimal(value).abs(), digits)}`;
export const percent = (value: Decimal.Value) => `${localizedDecimal(value, 2)}%`;
export const unitLabel = (unit: string) => ({ g: "gram", kg: "kg", ml: "ml", liter: "liter", buah: "buah" })[unit as Unit] || unit;
export const outputLabel = (c: Calculation) => c.outputUnit === "lainnya" ? c.customUnit || "satuan" : c.outputUnit;

export function subtotalIngredient(item: Ingredient) { return dec(parseQuantity(item.quantity)).mul(dec(parseMoney(item.price))); }
export function subtotalPackage(item: PackageItem) { return dec(parseQuantity(item.quantity)).mul(dec(parseMoney(item.price))); }
export function subtotalLabor(item: LaborItem) { return dec(parseQuantity(item.people)).mul(dec(parseMoney(item.wage))); }
export function subtotalOther(item: OtherItem) { return dec(parseMoney(item.amount)); }

export function calculate(c: Calculation) {
  const B = c.ingredients.reduce((sum, item) => sum.plus(subtotalIngredient(item)), zero);
  const K = c.packages.reduce((sum, item) => sum.plus(subtotalPackage(item)), zero);
  const L = c.labor.reduce((sum, item) => sum.plus(subtotalLabor(item)), zero);
  const O = c.others.reduce((sum, item) => sum.plus(subtotalOther(item)), zero);
  const T = B.plus(K).plus(L).plus(O);
  const N = dec(parseQuantity(c.batch));
  const C = N.gt(0) ? T.div(N) : zero;
  const m = dec(parseQuantity(c.margin)).div(100);
  const taxRate = c.taxEnabled ? dec(parseQuantity(c.taxRate)).div(100) : zero;
  const factor = new Decimal(1).plus(taxRate);
  const step = new Decimal(c.rounding);
  const canPrice = T.gt(0) && N.gt(0) && m.lt(1);
  const targetBeforeTax = canPrice ? C.div(new Decimal(1).minus(m)) : zero;
  const target = c.taxEnabled && c.taxMode === "inclusive" ? targetBeforeTax.mul(factor) : targetBeforeTax;
  const suggested = canPrice ? target.div(step).ceil().mul(step) : zero;
  const manual = dec(parseMoney(c.manualPrice));
  const effective = manual.gt(0) ? manual : suggested;
  const customerPrice = c.taxEnabled && c.taxMode === "exclusive" ? effective.mul(factor) : effective;
  const beforeTax = c.taxEnabled && c.taxMode === "inclusive" ? effective.div(factor) : effective;
  const tax = customerPrice.minus(beforeTax);
  const difference = beforeTax.minus(C);
  const actualMargin = beforeTax.gt(0) ? difference.div(beforeTax).mul(100) : zero;
  const minimum = C.mul(factor);
  const comparedPrice = c.taxEnabled && c.taxMode === "inclusive" ? effective : beforeTax;
  const comparedCost = c.taxEnabled && c.taxMode === "inclusive" ? T.mul(factor) : T;
  const coversCost = comparedPrice.mul(N).gte(comparedCost);
  const reachesTarget = comparedPrice.mul(new Decimal(1).minus(m)).mul(N).gte(comparedCost);
  const priceStatus = !coversCost ? "Belum menutup biaya" : !reachesTarget ? "Target margin belum tercapai" : "Target margin tercapai";
  const missing = (["packages", "labor", "others"] as const).filter(key => c.statuses[key] === "pending").map(key => ({ packages: "Kemasan", labor: "Tenaga kerja", others: "Biaya produksi lainnya" })[key]);
  return { B, K, L, O, T, C, targetBeforeTax, target, suggested, effective, beforeTax, customerPrice, tax, difference, actualMargin, minimum, priceStatus, missing, canPrice };
}

function validNumber(value: string, kind: "quantity" | "money" | "rate", positive = false) {
  const normalized = kind === "money" ? parseMoney(value) : parseQuantity(value);
  const maxDecimals = kind === "rate" ? 2 : 6;
  const max = kind === "money" ? new Decimal("1000000000000") : new Decimal("1000000");
  if (!new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`).test(normalized)) return false;
  const number = new Decimal(normalized);
  return (positive ? number.gt(0) : number.gte(0)) && number.lte(max);
}

export function validate(c: Calculation) {
  const errors: Record<string, string> = {};
  if (!c.name.trim() || c.name.trim().length > 120) errors.name = "Nama produk wajib diisi (maks. 120 karakter).";
  if (!c.business.trim()) errors.business = "Nama usaha wajib diisi.";
  if (!/^\d+$/.test(c.batch) || Number(c.batch) < 1 || Number(c.batch) > 1000000) errors.batch = "Ukuran batch harus 1–1.000.000.";
  if (c.outputUnit === "lainnya" && (!c.customUnit.trim() || c.customUnit.length > 30)) errors.customUnit = "Isi nama satuan (maks. 30 karakter).";
  if (c.note.length > 500) errors.note = "Catatan maksimal 500 karakter.";
  let completeIngredients = 0;
  c.ingredients.forEach((item, index) => {
    const touched = item.name.trim() || item.quantity.trim() || item.price.trim();
    if (!touched) return;
    if (!item.name.trim() || item.name.length > 100) errors[`ingredient-${index}-name`] = "Lengkapi nama bahan (maks. 100 karakter).";
    if (!validNumber(item.quantity, "quantity", true)) errors[`ingredient-${index}-quantity`] = "Jumlah digunakan harus lebih dari 0.";
    if (!validNumber(item.price, "money")) errors[`ingredient-${index}-price`] = `Harga per ${unitLabel(item.unit)} belum diisi atau tidak valid.`;
    if (!errors[`ingredient-${index}-name`] && !errors[`ingredient-${index}-quantity`] && !errors[`ingredient-${index}-price`]) completeIngredients++;
  });
  if (!completeIngredients) errors.ingredients = "Tambahkan minimal satu bahan baku lengkap.";
  c.packages.forEach((item, index) => {
    if (!item.name.trim()) errors[`package-${index}-name`] = "Nama kemasan wajib diisi.";
    if (!/^\d+$/.test(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 1000000) errors[`package-${index}-quantity`] = "Jumlah harus bilangan bulat lebih dari 0.";
    if (!validNumber(item.price, "money")) errors[`package-${index}-price`] = "Harga per buah belum diisi atau tidak valid.";
  });
  c.labor.forEach((item, index) => {
    if (!item.name.trim()) errors[`labor-${index}-name`] = "Keterangan pekerjaan wajib diisi.";
    if (!/^\d+$/.test(item.people) || Number(item.people) < 1 || Number(item.people) > 1000000) errors[`labor-${index}-people`] = "Jumlah orang harus bilangan bulat lebih dari 0.";
    if (!validNumber(item.wage, "money")) errors[`labor-${index}-wage`] = "Upah belum diisi atau tidak valid.";
  });
  c.others.forEach((item, index) => {
    if (item.type === "Lainnya" && !item.note.trim()) errors[`other-${index}-note`] = "Keterangan wajib untuk jenis lainnya.";
    if (!validNumber(item.amount, "money")) errors[`other-${index}-amount`] = "Biaya batch belum diisi atau tidak valid.";
  });
  (["packages", "labor", "others"] as const).forEach(key => {
    if (c[key].length && c.statuses[key] !== "filled") errors[key] = "Kategori berisi baris tetapi status belum Diisi.";
    if (!c[key].length && c.statuses[key] === "filled") errors[key] = "Tambahkan baris atau ubah status kategori.";
  });
  if (!validNumber(c.margin, "rate") || new Decimal(parseQuantity(c.margin) || 0).gte(100)) errors.margin = "Target margin harus 0–99,99%.";
  if (c.taxEnabled) {
    if (!c.taxName.trim() || c.taxName.length > 60) errors.taxName = "Nama pajak wajib diisi (maks. 60 karakter).";
    if (!validNumber(c.taxRate, "rate") || new Decimal(parseQuantity(c.taxRate) || 0).gt(100)) errors.taxRate = "Tarif pajak harus 0–100%.";
  }
  if (c.manualPrice && !validNumber(c.manualPrice, "money", true)) errors.manualPrice = "Harga jual pilihan harus lebih dari Rp0.";
  if (calculate(c).T.lte(0)) errors.total = "Total biaya produksi harus lebih dari Rp0.";
  return errors;
}

export function convertUnit(item: Ingredient, nextUnit: Unit): Ingredient | null | undefined {
  const groups: Record<Unit, string> = { g: "mass", kg: "mass", ml: "volume", liter: "volume", buah: "count" };
  if (groups[item.unit] !== groups[nextUnit]) return null;
  const factors: Record<Unit, Decimal> = { g: new Decimal(1), kg: new Decimal(1000), ml: new Decimal(1), liter: new Decimal(1000), buah: new Decimal(1) };
  if (!item.quantity || !item.price) return { ...item, unit: nextUnit };
  const quantity = dec(parseQuantity(item.quantity)).mul(factors[item.unit]).div(factors[nextUnit]);
  const price = dec(parseMoney(item.price)).mul(factors[nextUnit]).div(factors[item.unit]);
  if (quantity.decimalPlaces() > 6 || price.decimalPlaces() > 6) return undefined;
  return { ...item, unit: nextUnit, quantity: quantity.toString(), price: price.toFixed().replace(".",",") };
}

export function hydrateSnapshot(snapshot:Record<string,unknown>):ReturnType<typeof calculate>{
  const decimalKeys=["B","K","L","O","T","C","targetBeforeTax","target","suggested","effective","beforeTax","customerPrice","tax","difference","actualMargin","minimum"];
  return Object.fromEntries(Object.entries(snapshot).map(([key,value])=>[key,decimalKeys.includes(key)?new Decimal(String(value)):value])) as ReturnType<typeof calculate>;
}

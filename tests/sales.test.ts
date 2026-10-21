import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSales, parseSaleDate, previousRange, salesDayInputSchema, type SalesDay } from "../src/lib/sales";

const rice = "11111111-1111-4111-8111-111111111111";
const coffee = "22222222-2222-4222-8222-222222222222";
const days: SalesDay[] = [
  { date: "2026-10-19", version: 1, note: "", updatedAt: "2026-10-19T10:00:00Z", channels: [
    { channel: "GoFood", orders: 2, deductions: "6000", items: [
      { calculationId: rice, name: "Rice Bowl", unit: "porsi", revision: 1, unitCost: "13000", quantity: 3, gross: "60000" },
    ] },
    { channel: "WhatsApp", orders: 1, deductions: "0", items: [
      { calculationId: rice, name: "Rice Bowl", unit: "porsi", revision: 1, unitCost: "13000", quantity: 1, gross: "21000" },
    ] },
  ] },
  { date: "2026-10-20", version: 1, note: "", updatedAt: "2026-10-20T10:00:00Z", channels: [
    { channel: "gofood", orders: 1, deductions: "3000", items: [
      { calculationId: coffee, name: "Es Kopi", unit: "cup", revision: 1, unitCost: "8900", quantity: 2, gross: "30000" },
    ] },
  ] },
];

test("rekap memisahkan jumlah pesanan dan jumlah produk, serta menjaga HPP historis", () => {
  const result = analyzeSales(days);
  assert.equal(result.total.orders, 4);
  assert.equal(result.total.units, 6);
  assert.equal(result.total.net, "102000.00");
  assert.equal(result.total.cost, "69800.00");
  assert.equal(result.total.contribution, "32200.00");
  assert.deepEqual(result.channels.map(channel => [channel.name, channel.orders]), [["GoFood", 3], ["WhatsApp", 1]]);
  assert.deepEqual(result.menus.map(menu => [menu.name, menu.units, menu.contribution]),
    [["Rice Bowl", 4, "23000.00"], ["Es Kopi", 2, "9200.00"]]);
  const changedPrice = structuredClone(days);
  changedPrice[0].channels[0].items[0].unitCost = "15000";
  assert.equal(analyzeSales(days).total.cost, "69800.00");
  assert.equal(analyzeSales(changedPrice).total.cost, "75800.00");
});

test("tanggal kalender dan periode pembanding sama panjang", () => {
  assert.deepEqual(previousRange("2026-10-14", "2026-10-20"), { from: "2026-10-07", to: "2026-10-13" });
  assert.throws(() => parseSaleDate("2026-02-30", "2026-10-20"));
  assert.throws(() => parseSaleDate("2026-10-21", "2026-10-20"));
  assert.throws(() => previousRange("2026-10-21", "2026-10-20"));
});

test("rekap menolak pesanan lebih banyak dari produk dan potongan melebihi omzet", () => {
  const input = { date: "2026-10-20", version: 0, note: "", channels: [
    { channel: "GoFood", orders: 2, deductions: "20000", items: [{ calculationId: rice, quantity: 1, gross: "10000" }] },
  ] };
  assert.equal(salesDayInputSchema.safeParse(input).success, false);
  assert.equal(salesDayInputSchema.safeParse({ ...input, channels: [] }).success, true);
});

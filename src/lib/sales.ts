import Decimal from "decimal.js";
import { z } from "zod";

const amount = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Isi nominal rupiah tanpa pemisah ribuan.");
const lineInput = z.object({
  calculationId: z.uuid(),
  quantity: z.number().int().min(1).max(100000),
  gross: amount,
});
const channelInput = z.object({
  channel: z.string().trim().min(2).max(40),
  orders: z.number().int().min(1).max(100000),
  deductions: amount,
  items: z.array(lineInput).min(1).max(50),
}).superRefine((value, ctx) => {
  if (new Set(value.items.map(item => item.calculationId)).size !== value.items.length)
    ctx.addIssue({ code: "custom", path: ["items"], message: "Satu menu cukup dicatat sekali per kanal." });
  if (value.orders > value.items.reduce((sum, item) => sum + item.quantity, 0))
    ctx.addIssue({ code: "custom", path: ["orders"], message: "Jumlah pesanan tidak boleh melebihi produk terjual." });
  const gross = value.items.reduce((sum, item) => sum.plus(item.gross), new Decimal(0));
  if (new Decimal(value.deductions).gt(gross))
    ctx.addIssue({ code: "custom", path: ["deductions"], message: "Potongan tidak boleh melebihi penjualan kotor." });
});
export const salesDayInputSchema = z.object({
  date: z.iso.date(), version: z.number().int().min(0), note: z.string().max(500),
  channels: z.array(channelInput).max(12),
}).superRefine((value, ctx) => {
  if (new Set(value.channels.map(item => item.channel.toLocaleLowerCase("id"))).size !== value.channels.length)
    ctx.addIssue({ code: "custom", path: ["channels"], message: "Satu kanal cukup dicatat sekali per hari." });
});
export type SalesDayInput = z.infer<typeof salesDayInputSchema>;

export type SalesLine = SalesDayInput["channels"][number]["items"][number] & {
  name: string; unit: string; revision: number; unitCost: string;
};
export type SalesChannel = Omit<SalesDayInput["channels"][number], "items"> & { items: SalesLine[] };
export type SalesDay = { date: string; version: number; note: string; channels: SalesChannel[]; updatedAt: string };

export function businessToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function parseSaleDate(value: string, today = businessToday()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value || value < "2020-01-01" || value > today)
    throw new Error("Tanggal harus valid dan tidak boleh melewati hari ini.");
  return value;
}
export function previousRange(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const days = Math.round((end - start) / 86400000) + 1;
  if (days < 1) throw new Error("Tanggal akhir harus sama atau setelah tanggal awal.");
  const iso = (stamp: number) => new Date(stamp).toISOString().slice(0, 10);
  return { from: iso(start - days * 86400000), to: iso(start - 86400000) };
}

const sum = () => ({ orders: 0, units: 0, gross: new Decimal(0), deductions: new Decimal(0), cost: new Decimal(0) });
type Running = ReturnType<typeof sum>;
function finish(value: Running) {
  const net = value.gross.minus(value.deductions);
  return { orders: value.orders, units: value.units, gross: value.gross.toFixed(2),
    deductions: value.deductions.toFixed(2), net: net.toFixed(2),
    cost: value.cost.toFixed(2), contribution: net.minus(value.cost).toFixed(2) };
}
export function analyzeSales(days: SalesDay[]) {
  const total = sum();
  const channelMap = new Map<string, Running & { name: string }>();
  const menuMap = new Map<string, Running & { name: string; unit: string }>();
  const byDay = [];
  for (const day of days) {
    const daily = sum();
    for (const channel of day.channels) {
      const channelKey = channel.channel.toLocaleLowerCase("id");
      const channelTotal = channelMap.get(channelKey) ?? { ...sum(), name: channel.channel };
      channelTotal.orders += channel.orders; daily.orders += channel.orders; total.orders += channel.orders;
      const deductions = new Decimal(channel.deductions);
      channelTotal.deductions = channelTotal.deductions.plus(deductions);
      daily.deductions = daily.deductions.plus(deductions);
      total.deductions = total.deductions.plus(deductions);
      for (const item of channel.items) {
        const gross = new Decimal(item.gross);
        const cost = new Decimal(item.unitCost).mul(item.quantity);
        const menu = menuMap.get(item.calculationId) ?? { ...sum(), name: item.name, unit: item.unit };
        menu.name = item.name; menu.unit = item.unit;
        for (const record of [total, daily, channelTotal, menu]) {
          record.units += item.quantity;
          record.gross = record.gross.plus(gross);
          record.cost = record.cost.plus(cost);
        }
        menuMap.set(item.calculationId, menu);
      }
      channelMap.set(channelKey, channelTotal);
      // Allocate kanal deductions to menus by their share of gross revenue.
      const channelGross = channel.items.reduce((value, item) => value.plus(item.gross), new Decimal(0));
      if (channelGross.gt(0)) for (const item of channel.items) {
        const menu = menuMap.get(item.calculationId)!;
        menu.deductions = menu.deductions.plus(deductions.mul(item.gross).div(channelGross));
      }
    }
    byDay.push({ date: day.date, ...finish(daily) });
  }
  return { total: finish(total), recordedDays: days.length,
    channels: [...channelMap.values()].map(value => ({ name: value.name, ...finish(value) })).sort((a, b) => b.orders - a.orders || b.units - a.units),
    menus: [...menuMap].map(([id, value]) => ({ id, name: value.name, unit: value.unit, ...finish(value) })).sort((a, b) => b.units - a.units),
    days: byDay.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

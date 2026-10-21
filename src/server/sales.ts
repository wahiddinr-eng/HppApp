import { salesDayInputSchema, parseSaleDate, previousRange, analyzeSales, type SalesChannel, type SalesDay, type SalesDayInput } from "../lib/sales";
import { query, transaction } from "./db";
import { DomainError } from "./http";

type DayRow = { sale_date: string; version: number; note: string; channels: SalesChannel[]; updated_at: Date };
type ProductRow = { id: string; name: string; unit: string; revision: number; cost: string; price: string };
function fromRow(row: DayRow): SalesDay {
  return { date: row.sale_date, version: row.version, note: row.note, channels: row.channels, updatedAt: row.updated_at.toISOString() };
}
function validDate(value: string) {
  try { return parseSaleDate(value); }
  catch { throw new DomainError(422, "INVALID_DATE", "Tanggal tidak valid atau melewati hari ini."); }
}
export async function saleProducts(owner: string) {
  const result = await query<ProductRow>(`SELECT c.id,r.input->>'name' AS name,r.input->>'outputUnit' AS unit,
    r.revision,r.result->>'C' AS cost,r.result->>'customerPrice' AS price
    FROM calculation c JOIN calculation_revision r ON r.calculation_id=c.id AND r.revision=c.latest_revision
    WHERE c.owner_id=$1 AND c.archived=false AND c.latest_revision>0 ORDER BY name`, [owner]);
  return result.rows;
}
export async function getSalesDay(owner: string, value: string) {
  const date = validDate(value);
  const result = await query<DayRow>(`SELECT sale_date::text,version,note,channels,updated_at FROM daily_sales
    WHERE owner_id=$1 AND sale_date=$2`, [owner, date]);
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}
export async function saveSalesDay(owner: string, value: unknown) {
  const parsed = salesDayInputSchema.safeParse(value);
  if (!parsed.success) throw new DomainError(422, "INVALID_SALES_DAY", "Periksa tanggal, jumlah pesanan, produk, dan nominal penjualan.",
    Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message])));
  const input: SalesDayInput = parsed.data;
  validDate(input.date);
  return transaction(async client => {
    const prior = await client.query<DayRow>(`SELECT sale_date::text,version,note,channels,updated_at FROM daily_sales
      WHERE owner_id=$1 AND sale_date=$2 FOR UPDATE`, [owner, input.date]);
    const previous = prior.rows[0];
    if ((previous?.version ?? 0) !== input.version) throw new DomainError(409, "SALES_DAY_CONFLICT", "Rekap hari ini berubah di tab lain. Muat ulang sebelum menyimpan.");
    const existing = new Map<string, SalesChannel["items"][number]>();
    for (const channel of previous?.channels ?? []) for (const item of channel.items)
      existing.set(item.calculationId, item);
    const ids = [...new Set(input.channels.flatMap(channel => channel.items.map(item => item.calculationId)))];
    const catalog = ids.length ? await client.query<ProductRow>(`SELECT c.id,r.input->>'name' AS name,
      r.input->>'outputUnit' AS unit,r.revision,r.result->>'C' AS cost,r.result->>'customerPrice' AS price
      FROM calculation c JOIN calculation_revision r ON r.calculation_id=c.id AND r.revision=c.latest_revision
      WHERE c.owner_id=$1 AND c.archived=false AND c.id=ANY($2::uuid[])`, [owner, ids]) : { rows: [] as ProductRow[] };
    const products = new Map(catalog.rows.map(row => [row.id, row]));
    const channels: SalesChannel[] = input.channels.map(channel => ({
      channel: channel.channel, orders: channel.orders, deductions: channel.deductions,
      items: channel.items.map(item => {
        const saved = existing.get(item.calculationId);
        const current = products.get(item.calculationId);
        if (!saved && !current) throw new DomainError(422, "PRODUCT_UNAVAILABLE", "Pilih produk milik akun ini yang sudah dihitung HPP-nya.");
        return { ...item, name: saved?.name ?? current!.name, unit: saved?.unit ?? current!.unit,
          revision: saved?.revision ?? current!.revision, unitCost: saved?.unitCost ?? current!.cost };
      }),
    }));
    const result = previous
      ? await client.query<DayRow>(`UPDATE daily_sales SET channels=$3,note=$4,version=version+1,updated_at=now()
          WHERE owner_id=$1 AND sale_date=$2 AND version=$5 RETURNING sale_date::text,version,note,channels,updated_at`,
        [owner, input.date, JSON.stringify(channels), input.note, input.version])
      : await client.query<DayRow>(`INSERT INTO daily_sales(owner_id,sale_date,channels,note)
          VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING sale_date::text,version,note,channels,updated_at`,
        [owner, input.date, JSON.stringify(channels), input.note]);
    if (!result.rows[0]) throw new DomainError(409, "SALES_DAY_CONFLICT", "Rekap hari ini berubah. Muat ulang sebelum menyimpan.");
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,$2,$3,$4)",
      [owner, "sales.day.save", input.date, previous ? `version ${input.version} to ${input.version + 1}` : "version 1"]);
    return fromRow(result.rows[0]);
  });
}
export async function salesAnalysis(owner: string, fromValue: string, toValue: string) {
  const from = validDate(fromValue);
  const to = validDate(toValue);
  if (from > to) throw new DomainError(422, "INVALID_RANGE", "Tanggal akhir harus sama atau setelah tanggal awal.");
  const previous = previousRange(from, to);
  const result = await query<DayRow>(`SELECT sale_date::text,version,note,channels,updated_at FROM daily_sales
    WHERE owner_id=$1 AND sale_date BETWEEN $2 AND $3 ORDER BY sale_date`, [owner, previous.from, to]);
  const days = result.rows.map(fromRow);
  return { from, to, previousRange: previous,
    current: analyzeSales(days.filter(day => day.date >= from)),
    previous: analyzeSales(days.filter(day => day.date >= previous.from && day.date <= previous.to)),
  };
}

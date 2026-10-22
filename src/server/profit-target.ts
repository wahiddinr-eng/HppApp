import { profitTargetSchema, type ProfitTargetInput } from "../lib/profit-target";
import { businessToday } from "../lib/sales";
import { query } from "./db";
import { DomainError } from "./http";
import { salesAnalysis } from "./sales";

type TargetRow = { settings: ProfitTargetInput; version: number; updated_at: Date };

export async function getProfitTarget(owner: string) {
  const today = businessToday();
  const recentFrom = new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  const [row, month, recent] = await Promise.all([
    query<TargetRow>("SELECT settings,version,updated_at FROM profit_target WHERE owner_id=$1", [owner]),
    salesAnalysis(owner, `${today.slice(0, 7)}-01`, today),
    salesAnalysis(owner, recentFrom, today),
  ]);
  const saved = row.rows[0];
  return {
    saved: saved ? { settings: profitTargetSchema.parse(saved.settings), version: saved.version,
      updatedAt: saved.updated_at.toISOString() } : null,
    actual: { month: today.slice(0, 7), recordedDays: month.current.recordedDays,
      units: month.current.total.units, contribution: month.current.total.contribution },
    recent: { from: recentFrom, to: today, recordedDays: recent.current.recordedDays,
      units: recent.current.total.units, contribution: recent.current.total.contribution },
  };
}

export function parseProfitTarget(value: unknown): ProfitTargetInput {
  const parsed = profitTargetSchema.safeParse(value);
  if (!parsed.success) throw new DomainError(422, "INVALID_PROFIT_TARGET", "Periksa biaya tetap, target penghasilan, dan hari berjualan.",
    Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message])));
  return parsed.data;
}

export async function writeProfitTarget(owner: string, settings: ProfitTargetInput, version: number) {
  if (!Number.isInteger(version) || version < 0) throw new DomainError(422, "INVALID_VERSION", "Versi pengaturan tidak valid.");
  const result = version === 0
    ? await query<TargetRow>(`INSERT INTO profit_target(owner_id,settings) VALUES($1,$2)
        ON CONFLICT DO NOTHING RETURNING settings,version,updated_at`, [owner, JSON.stringify(settings)])
    : await query<TargetRow>(`UPDATE profit_target SET settings=$2,version=version+1,updated_at=now()
        WHERE owner_id=$1 AND version=$3 RETURNING settings,version,updated_at`, [owner, JSON.stringify(settings), version]);
  if (!result.rows[0]) throw new DomainError(409, "PROFIT_TARGET_CONFLICT", "Target berubah di tab lain. Muat ulang sebelum menyimpan.");
  return { settings: profitTargetSchema.parse(result.rows[0].settings), version: result.rows[0].version,
    updatedAt: result.rows[0].updated_at.toISOString() };
}

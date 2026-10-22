import Decimal from "decimal.js";
import { z } from "zod";

const money = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Isi nominal rupiah tanpa pemisah ribuan.");

// Zod strips the former `mix` field from saved plans. The three financial
// assumptions remain intact when a customer opens a plan made before v2.
export const profitTargetSchema = z.object({
  monthlyFixedCost: money,
  monthlyProfitGoal: money,
  operatingDays: z.number().int().min(1).max(31),
});

export type ProfitTargetInput = z.infer<typeof profitTargetSchema>;
export type RecentSales = { recordedDays: number; units: number; contribution: string };

export function calculateProfitTarget(input: ProfitTargetInput, recent?: RecentSales) {
  const config = profitTargetSchema.parse(input);
  const fixed = new Decimal(config.monthlyFixedCost);
  const goal = new Decimal(config.monthlyProfitGoal);
  const required = fixed.plus(goal);
  const daily = (value: Decimal) => value.div(config.operatingDays).ceil().toFixed(0);
  const monthlyUnits = (value: Decimal, average: Decimal) => {
    const count = value.div(average).ceil().toNumber();
    if (!Number.isSafeInteger(count)) throw new Error("Target produk terlalu besar untuk dihitung.");
    return count;
  };

  let estimatedUnits: null | {
    averageContribution: string;
    breakEvenMonthly: number; breakEvenDaily: number;
    targetMonthly: number; targetDaily: number;
  } = null;
  let historyStatus: "insufficient" | "nonpositive" | "ready" = "insufficient";
  if (recent && recent.recordedDays >= 7 && Number.isSafeInteger(recent.units) && recent.units >= 20) {
    const contribution = new Decimal(recent.contribution);
    if (contribution.isFinite() && contribution.gt(0)) {
      const average = contribution.div(recent.units);
      const breakEvenMonthly = monthlyUnits(fixed, average);
      const targetMonthly = monthlyUnits(required, average);
      estimatedUnits = {
        averageContribution: average.toFixed(2), breakEvenMonthly,
        breakEvenDaily: Math.ceil(breakEvenMonthly / config.operatingDays),
        targetMonthly, targetDaily: Math.ceil(targetMonthly / config.operatingDays),
      };
      historyStatus = "ready";
    } else historyStatus = "nonpositive";
  }
  return {
    breakEvenMonthlyContribution: fixed.toFixed(2),
    breakEvenDailyContribution: daily(fixed),
    targetMonthlyContribution: required.toFixed(2),
    targetDailyContribution: daily(required),
    estimatedUnits,
    historyStatus,
  };
}

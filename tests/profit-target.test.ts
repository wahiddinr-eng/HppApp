import assert from "node:assert/strict";
import test from "node:test";
import { calculateProfitTarget, profitTargetSchema } from "../src/lib/profit-target";

const settings = { monthlyFixedCost: "2500000", monthlyProfitGoal: "3000000", operatingDays: 26 };

test("target uang bulanan dan harian tidak bergantung pada menu atau kanal", () => {
  const result = calculateProfitTarget(settings);
  assert.equal(result.breakEvenMonthlyContribution, "2500000.00");
  assert.equal(result.breakEvenDailyContribution, "96154");
  assert.equal(result.targetMonthlyContribution, "5500000.00");
  assert.equal(result.targetDailyContribution, "211539");
  assert.equal(result.estimatedUnits, null);
  assert.equal(result.historyStatus, "insufficient");
});

test("perkiraan total produk memakai kontribusi aktual lintas menu dan kanal", () => {
  const result = calculateProfitTarget(settings, { recordedDays: 14, units: 100, contribution: "800000" });
  assert.deepEqual(result.estimatedUnits, {
    averageContribution: "8000.00", breakEvenMonthly: 313, breakEvenDaily: 13,
    targetMonthly: 688, targetDaily: 27,
  });
  assert.equal(result.historyStatus, "ready");
});

test("perkiraan produk disembunyikan bila riwayat belum cukup atau hasil tidak positif", () => {
  for (const recent of [
    { recordedDays: 6, units: 100, contribution: "800000" },
    { recordedDays: 14, units: 19, contribution: "800000" },
  ]) {
    const result = calculateProfitTarget(settings, recent);
    assert.equal(result.estimatedUnits, null);
    assert.equal(result.historyStatus, "insufficient");
  }
  const loss = calculateProfitTarget(settings, { recordedDays: 14, units: 100, contribution: "-10000" });
  assert.equal(loss.estimatedUnits, null);
  assert.equal(loss.historyStatus, "nonpositive");
});

test("rencana lama mempertahankan tiga angka tanpa komposisi menu", () => {
  const parsed = profitTargetSchema.parse({ ...settings, mix: [{ calculationId: "old", channelId: "direct", share: 100 }] });
  assert.deepEqual(parsed, settings);
  assert.equal(profitTargetSchema.safeParse({ ...settings, operatingDays: 0 }).success, false);
  assert.equal(profitTargetSchema.safeParse({ ...settings, monthlyFixedCost: "-1" }).success, false);
});

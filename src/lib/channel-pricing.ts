import Decimal from "decimal.js";
import { z } from "zod";

const percent = z.string().regex(/^\d{1,2}(?:\.\d{1,2})?$/).refine((value) => new Decimal(value).lt(100));
const money = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/);

export const channelSettingSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  name: z.string().trim().min(2).max(40),
  commissionRate: percent,
  promoRate: percent,
  otherRate: percent,
  fixedFee: money,
  extraCost: money,
  targetMargin: percent,
  rounding: z.enum(["1", "500", "1000"]),
}).refine((value) => new Decimal(value.commissionRate).plus(value.promoRate).plus(value.otherRate).lt(100), {
  message: "Jumlah persentase potongan harus kurang dari 100%.",
  path: ["commissionRate"],
});

export const channelSettingsSchema = z.array(channelSettingSchema).max(8).refine(
  (items) => new Set(items.map((item) => item.id)).size === items.length,
  "ID kanal tidak boleh sama.",
);

export type ChannelSetting = z.infer<typeof channelSettingSchema>;

export function defaultChannels(margin = "30", rounding: ChannelSetting["rounding"] = "500"): ChannelSetting[] {
  return ["GoFood", "ShopeeFood", "GrabFood"].map((name) => ({
    id: name.toLowerCase(), name, commissionRate: "0", promoRate: "0", otherRate: "0",
    fixedFee: "0", extraCost: "0", targetMargin: margin, rounding,
  }));
}

export function calculateChannelPrice(unitCost: Decimal.Value, value: ChannelSetting) {
  const setting = channelSettingSchema.parse(value);
  const cost = new Decimal(unitCost);
  if (!cost.isFinite() || cost.lte(0)) throw new Error("HPP per porsi harus lebih dari nol.");
  const fees = new Decimal(setting.commissionRate).plus(setting.promoRate).plus(setting.otherRate).div(100);
  const retained = new Decimal(1).minus(fees);
  const margin = new Decimal(setting.targetMargin).div(100);
  const fixed = new Decimal(setting.fixedFee);
  const totalCost = cost.plus(setting.extraCost);
  const step = new Decimal(setting.rounding);
  const roundUp = (amount: Decimal) => amount.div(step).ceil().mul(step);
  const breakEven = roundUp(totalCost.plus(fixed).div(retained));
  const menuPrice = roundUp(totalCost.div(new Decimal(1).minus(margin)).plus(fixed).div(retained));
  const variableFees = menuPrice.mul(fees);
  const netRevenue = menuPrice.minus(variableFees).minus(fixed);
  const profit = netRevenue.minus(totalCost);
  const actualMargin = netRevenue.gt(0) ? profit.div(netRevenue).mul(100) : new Decimal(0);
  const fixed2 = (number: Decimal) => number.toFixed(2);
  return {
    menuPrice: fixed2(menuPrice), breakEven: fixed2(breakEven), variableFees: fixed2(variableFees),
    netRevenue: fixed2(netRevenue), totalCost: fixed2(totalCost), profit: fixed2(profit),
    actualMargin: fixed2(actualMargin), totalRate: fixed2(fees.mul(100)),
  };
}

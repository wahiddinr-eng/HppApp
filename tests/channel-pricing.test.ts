import assert from "node:assert/strict";
import test from "node:test";
import { calculateChannelPrice, channelSettingSchema, defaultChannels } from "../src/lib/channel-pricing";

test("harga kanal menutup HPP, biaya tambahan, potongan, dan margin target", () => {
  const setting = {
    ...defaultChannels("30")[0], commissionRate: "20", fixedFee: "1000", extraCost: "2000",
  };
  const price = calculateChannelPrice("10000", setting);
  assert.equal(price.menuPrice, "23000.00");
  assert.equal(price.breakEven, "16500.00");
  assert.equal(price.variableFees, "4600.00");
  assert.equal(price.netRevenue, "17400.00");
  assert.equal(price.totalCost, "12000.00");
  assert.equal(price.profit, "5400.00");
  assert.equal(price.actualMargin, "31.03");
});

test("preset platform tidak menebak tarif merchant", () => {
  const defaults = defaultChannels("25", "1000");
  assert.deepEqual(defaults.map((item) => item.name), ["GoFood", "ShopeeFood", "GrabFood"]);
  assert.ok(defaults.every((item) => item.commissionRate === "0" && item.promoRate === "0" && item.targetMargin === "25"));
});

test("potongan total 100 persen dan input tidak valid ditolak", () => {
  const setting = { ...defaultChannels()[0], commissionRate: "90", promoRate: "10" };
  assert.equal(channelSettingSchema.safeParse(setting).success, false);
  assert.throws(() => calculateChannelPrice("0", defaultChannels()[0]), /lebih dari nol/);
  assert.equal(channelSettingSchema.safeParse({ ...defaultChannels()[0], fixedFee: "-1" }).success, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { purchaseConfig, verifyPurchaseSignature } from "../src/server/purchases";

test("webhook accepts a prompt-only catalog and rejects unsigned events", () => {
  const names = ["PURCHASE_SOURCE_ID", "PURCHASE_WEBHOOK_KEYS", "ELIGIBLE_AI_FOOD_PRODUCT_IDS", "PROMPT_GALLERY_PRODUCT_IDS"] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.PURCHASE_SOURCE_ID = "app.lrmobileid.com";
    process.env.PURCHASE_WEBHOOK_KEYS = JSON.stringify({ primary: {
      source: "app.lrmobileid.com", secret: "test-secret-at-least-32-characters-long",
    } });
    process.env.ELIGIBLE_AI_FOOD_PRODUCT_IDS = "";
    process.env.PROMPT_GALLERY_PRODUCT_IDS = "prompt-product";
    const config = purchaseConfig();
    assert.deepEqual(config.products, []);
    assert.deepEqual(config.promptProducts, ["prompt-product"]);
    assert.throws(() => verifyPurchaseSignature(Buffer.from("{}"), new Headers()), { code: "INVALID_SIGNATURE" });

    process.env.PROMPT_GALLERY_PRODUCT_IDS = "";
    assert.throws(() => purchaseConfig(), { code: "WEBHOOK_CONFIG" });
  } finally {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

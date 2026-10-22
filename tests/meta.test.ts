import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildPurchaseMetaEvent, captureMetaContext } from "../src/server/meta";
import { decryptMetaToken, encryptMetaToken, environmentMetaConfig } from "../src/server/meta-settings";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

test("Meta Purchase uses the order snapshot and hashed matching data without payment token", () => {
  process.env.APP_BASE_URL = "https://hpp.lrmobileid.com";
  const event = buildPurchaseMetaEvent({ id: "00000000-0000-4000-8000-000000000001", code: "KK-123ABC",
    price: 125000, customer_name: "Budi Santoso", customer_email: "  BUDI@EXAMPLE.COM ", customer_phone: "+6281234567890",
    meta_context: { client_ip_address: "203.0.113.10", client_user_agent: "Test Browser", fbp: "fb.1.1234567890123.123456" } });
  assert.equal(event.event_name, "Purchase");
  assert.equal(event.action_source, "website");
  assert.equal(event.event_id, "kulinerkit-purchase-00000000-0000-4000-8000-000000000001");
  assert.equal(event.event_source_url, "https://hpp.lrmobileid.com/checkout");
  assert.equal(event.user_data.em, sha("budi@example.com"));
  assert.equal(event.user_data.ph, sha("6281234567890"));
  assert.equal(event.user_data.fn, sha("budi"));
  assert.equal(event.user_data.ln, sha("santoso"));
  assert.equal(event.user_data.client_ip_address, "203.0.113.10");
  assert.deepEqual(event.custom_data.content_ids, ["kulinerkit_bundle"]);
  assert.equal(event.custom_data.value, 125000);
  assert.equal(event.custom_data.currency, "IDR");
  assert.equal(event.custom_data.order_id, "KK-123ABC");
  assert.doesNotMatch(JSON.stringify(event), /BUDI@EXAMPLE|6281234567890|\/pay\//);
});

test("Meta context accepts only bounded Meta cookies and valid IPs", () => {
  const request = new Request("https://hpp.lrmobileid.com/checkout", { headers: {
    "x-real-ip": "203.0.113.10", "user-agent": "Test Browser", cookie: "_fbp=fb.1.1234567890123.123456; _fbc=fb.1.1234567890123.AbCd_123" } });
  assert.deepEqual(captureMetaContext(request), { client_ip_address: "203.0.113.10", client_user_agent: "Test Browser",
    fbp: "fb.1.1234567890123.123456", fbc: "fb.1.1234567890123.AbCd_123" });
  const invalid = new Request("https://hpp.lrmobileid.com/", { headers: { "x-real-ip": "spoof", cookie: "_fbp=bad; _fbc=bad" } });
  assert.deepEqual(captureMetaContext(invalid), {});
});

test("Meta tracking stays disabled without explicit flag and both credentials", () => {
  const prior = [process.env.META_TRACKING_ENABLED, process.env.META_PIXEL_ID, process.env.META_CAPI_ACCESS_TOKEN];
  try {
    process.env.META_PIXEL_ID = "123456789012345";
    process.env.META_CAPI_ACCESS_TOKEN = "test-token";
    delete process.env.META_TRACKING_ENABLED;
    assert.equal(environmentMetaConfig().enabled, false);
    process.env.META_TRACKING_ENABLED = "true";
    assert.equal(environmentMetaConfig().enabled, true);
    process.env.META_PIXEL_ID = "not-a-pixel";
    assert.equal(environmentMetaConfig().enabled, false);
  } finally {
    for (const [index, key] of ["META_TRACKING_ENABLED", "META_PIXEL_ID", "META_CAPI_ACCESS_TOKEN"].entries()) {
      if (prior[index] === undefined) delete process.env[key]; else process.env[key] = prior[index];
    }
  }
});

test("Meta CAPI token encryption is authenticated and bound to the server secret", () => {
  const previous = process.env.AUTH_SECRET;
  try {
    process.env.AUTH_SECRET = "meta-settings-unit-test-secret-at-least-32-chars";
    const encrypted = encryptMetaToken("test-capi-token");
    assert.notEqual(encrypted, "test-capi-token");
    assert.doesNotMatch(encrypted, /test-capi-token/);
    assert.equal(decryptMetaToken(encrypted), "test-capi-token");
    process.env.AUTH_SECRET = "different-meta-settings-secret-at-least-32-chars";
    assert.throws(() => decryptMetaToken(encrypted));
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previous;
  }
});

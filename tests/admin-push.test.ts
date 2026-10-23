import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import webpush from "web-push";
import manifest from "../src/app/manifest";
import { adminPushConfig, adminPushSubscriptionSchema, orderPushPayload, pushAgentForEndpoint } from "../src/server/admin-push";

test("iPhone install manifest has stable identity and branded icons", async () => {
  const value = manifest();
  assert.equal(value.id, "/app");
  assert.equal(value.display, "standalone");
  assert.equal(value.start_url, "/app");
  assert.equal(value.scope, "/");
  for (const icon of value.icons || []) {
    assert.ok(icon.src.startsWith("/icons/"));
    assert.ok((await readFile(new URL(`../public${icon.src}`, import.meta.url))).length > 0);
  }
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /showNotification/);
  assert.doesNotMatch(worker, /addEventListener\(["']fetch["']/);
});

test("admin push accepts only a bounded public HTTPS subscription", () => {
  const keys = webpush.generateVAPIDKeys();
  const input = { endpoint: "https://web.push.apple.com/test-subscription", keys: { p256dh: keys.publicKey, auth: randomBytes(16).toString("base64url") } };
  assert.equal(adminPushSubscriptionSchema.safeParse(input).success, true);
  assert.equal(adminPushSubscriptionSchema.safeParse({ ...input, endpoint: "http://web.push.apple.com/test" }).success, false);
  assert.equal(adminPushSubscriptionSchema.safeParse({ ...input, endpoint: "https://127.0.0.1/test" }).success, false);
  assert.equal(adminPushSubscriptionSchema.safeParse({ ...input, endpoint: "https://localhost/test" }).success, false);
  assert.equal(adminPushSubscriptionSchema.safeParse({ ...input, keys: { ...input.keys, auth: "bad" } }).success, false);
});

test("Apple push uses IPv4 without Node automatic family racing", () => {
  const agent = pushAgentForEndpoint("https://web.push.apple.com/example");
  assert.equal(agent?.options.family, 4);
  assert.equal(agent?.options.autoSelectFamily, false);
  assert.equal(pushAgentForEndpoint("https://fcm.googleapis.com/example"), undefined);
});

test("push is disabled without a complete VAPID pair and payload contains no buyer details", () => {
  const previous = [process.env.PUSH_VAPID_PUBLIC_KEY,process.env.PUSH_VAPID_PRIVATE_KEY,process.env.PUSH_VAPID_SUBJECT];
  try {
    delete process.env.PUSH_VAPID_PUBLIC_KEY;
    delete process.env.PUSH_VAPID_PRIVATE_KEY;
    delete process.env.PUSH_VAPID_SUBJECT;
    assert.equal(adminPushConfig(), null);
    const keys = webpush.generateVAPIDKeys();
    process.env.PUSH_VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.PUSH_VAPID_PRIVATE_KEY = keys.privateKey;
    process.env.PUSH_VAPID_SUBJECT = "mailto:admin@example.com";
    assert.equal(adminPushConfig()?.publicKey, keys.publicKey);
    process.env.PUSH_VAPID_SUBJECT = "https://localhost/contact";
    assert.equal(adminPushConfig(), null);
    process.env.PUSH_VAPID_SUBJECT = "mailto:admin@example.com";
    process.env.PUSH_VAPID_PUBLIC_KEY = webpush.generateVAPIDKeys().publicKey;
    assert.equal(adminPushConfig(), null);
    assert.deepEqual(JSON.parse(orderPushPayload("KK-123456ABCDEF")), {type:"new_order",code:"KK-123456ABCDEF"});
  } finally {
    for (const [index,key] of ["PUSH_VAPID_PUBLIC_KEY","PUSH_VAPID_PRIVATE_KEY","PUSH_VAPID_SUBJECT"].entries()) {
      if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
    }
  }
});

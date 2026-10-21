import test from "node:test";
import assert from "node:assert/strict";
import { KULINERKIT_SUPPORT_MESSAGE, KULINERKIT_WHATSAPP_URL } from "../src/lib/support";

test("WhatsApp bantuan memakai nomor dan identitas KulinerKit", () => {
  const url = new URL(KULINERKIT_WHATSAPP_URL);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/6285161218257");
  assert.equal(url.searchParams.get("text"), KULINERKIT_SUPPORT_MESSAGE);
  assert.match(KULINERKIT_SUPPORT_MESSAGE, /KulinerKit/);
  assert.match(KULINERKIT_SUPPORT_MESSAGE, /hpp\.lrmobileid\.com/);
});

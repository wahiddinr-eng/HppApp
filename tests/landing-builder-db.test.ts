import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { newLandingBlock } from "../src/lib/landing-builder";

const url = process.env.HPP_TEST_DATABASE_URL;
test("landing builder database: draft, publish, version conflict and delete", { skip: !url }, async () => {
  const database = new URL(url!);
  assert.ok(["localhost", "127.0.0.1"].includes(database.hostname) && /^\/hpp_test(?:_|$)/.test(database.pathname), "Only a local hpp_test database is allowed.");
  process.env.DATABASE_URL = url;
  process.env.APP_BASE_URL = "http://localhost:3000";
  process.env.AUTH_SECRET = "local-landing-test-secret-32-characters-only";
  const { auth } = await import("../src/server/auth");
  const { getMigrations } = await import("better-auth/db/migration");
  const { query, getPool } = await import("../src/server/db");
  const { saveLandingPage, getPublishedLandingPage, getLandingPage, deleteLandingPage } = await import("../src/server/landing-pages");
  try {
    await (await getMigrations(auth.options)).runMigrations();
    await query(await readFile(new URL("../db/domain.sql", import.meta.url), "utf8"));
    const suffix = randomUUID();
    const user = await auth.api.createUser({ body: { email: `landing-${suffix}@example.test`, password: "landing-test-password-123", name: "Admin uji", role: "admin" } });
    const input = { slug: `landing-${suffix}`, title: "Halaman uji", seoDescription: "Deskripsi uji", status: "draft" as const, metaViewContentEnabled: false,
      blocks: [newLandingBlock("HERO"), { ...newLandingBlock("CUSTOM_HTML"), html: "<p>Konten uji</p>" }] };
    const draft = await saveLandingPage(input, user.user.id);
    assert.equal(draft.version, 1);
    assert.equal(draft.metaViewContentEnabled, false);
    assert.equal(await getPublishedLandingPage(input.slug), null);
    assert.equal((await getLandingPage(draft.id)).blocks[1].type, "CUSTOM_HTML");
    const published = await saveLandingPage({ ...input, status: "published", metaViewContentEnabled: true }, user.user.id, draft.id, draft.version);
    assert.equal(published.status, "published");
    assert.equal(published.metaViewContentEnabled, true);
    assert.equal(published.version, 2);
    assert.equal((await getPublishedLandingPage(input.slug))?.id, draft.id);
    assert.equal((await getPublishedLandingPage(input.slug))?.metaViewContentEnabled, true);
    await assert.rejects(() => saveLandingPage(input, user.user.id, draft.id, draft.version), { code: "LANDING_CONFLICT" });
    await deleteLandingPage(draft.id, published.version, user.user.id);
    assert.equal(await getPublishedLandingPage(input.slug), null);
  } finally { await getPool().end(); }
});

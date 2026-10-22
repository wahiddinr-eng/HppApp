import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { query, transaction } from "./db";
import { DomainError } from "./http";

const pixelPattern = /^\d{8,25}$/;
const versionPattern = /^v\d{1,2}\.\d{1,2}$/;
const testCodePattern = /^[A-Za-z0-9_-]{0,64}$/;

export const metaSettingsSchema = z.object({
  version: z.number().int().min(0),
  enabled: z.boolean(),
  pixelId: z.string().trim().max(25),
  graphApiVersion: z.string().trim().regex(versionPattern, "Versi API harus seperti v26.0."),
  testEventCode: z.string().trim().regex(testCodePattern, "Kode tes hanya boleh berisi huruf, angka, _ atau -."),
  capiToken: z.string().trim().max(4096).optional(),
  clearToken: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.pixelId && !pixelPattern.test(value.pixelId)) context.addIssue({ code: "custom", path: ["pixelId"], message: "Pixel ID harus berisi 8–25 angka." });
  if (value.enabled && !value.pixelId) context.addIssue({ code: "custom", path: ["pixelId"], message: "Isi Pixel ID sebelum mengaktifkan tracking." });
  if (value.capiToken && value.clearToken) context.addIssue({ code: "custom", path: ["capiToken"], message: "Pilih isi token baru atau hapus token." });
});

type Row = { enabled: boolean; pixel_id: string; capi_token_ciphertext: string | null; graph_api_version: string;
  test_event_code: string; version: number; updated_at: Date; updated_by: string | null };
export type MetaRuntimeConfig = { enabled: boolean; requestedEnabled: boolean; pixelId: string; token: string; tokenReady: boolean;
  tokenUnreadable: boolean; version: string; testEventCode: string; source: "admin" | "environment"; settingsVersion: number; updatedAt: Date | null };

function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("META_ENCRYPTION_KEY_UNAVAILABLE");
  return createHash("sha256").update("kulinerkit-meta-capi-token-v1\0").update(secret).digest();
}

export function encryptMetaToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${encrypted.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}`;
}

export function decryptMetaToken(value: string) {
  const [version, iv, encrypted, tag] = value.split(":");
  if (version !== "v1" || !iv || !encrypted || !tag) throw new Error("META_TOKEN_UNREADABLE");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function environmentMetaConfig(): MetaRuntimeConfig {
  const pixelId = process.env.META_PIXEL_ID?.trim() || "";
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim() || "";
  const requestedEnabled = process.env.META_TRACKING_ENABLED === "true";
  return { requestedEnabled, enabled: requestedEnabled && pixelPattern.test(pixelId) && Boolean(token) && !token.includes("CHANGE_ME"),
    pixelId, token, tokenReady: Boolean(token), tokenUnreadable: false,
    version: versionPattern.test(process.env.META_GRAPH_API_VERSION || "") ? process.env.META_GRAPH_API_VERSION! : "v26.0",
    testEventCode: process.env.META_TEST_EVENT_CODE?.trim() || "", source: "environment", settingsVersion: 0, updatedAt: null };
}

function runtimeFromRow(row: Row): MetaRuntimeConfig {
  let token = "";
  let tokenUnreadable = false;
  if (row.capi_token_ciphertext) {
    try { token = decryptMetaToken(row.capi_token_ciphertext); }
    catch { tokenUnreadable = true; }
  }
  return { requestedEnabled: row.enabled, enabled: row.enabled && pixelPattern.test(row.pixel_id) && Boolean(token) && !token.includes("CHANGE_ME") && !tokenUnreadable,
    pixelId: row.pixel_id, token, tokenReady: Boolean(row.capi_token_ciphertext), tokenUnreadable,
    version: row.graph_api_version, testEventCode: row.test_event_code, source: "admin", settingsVersion: row.version, updatedAt: row.updated_at };
}

async function findRow(client?: PoolClient, forUpdate = false) {
  const sql = `SELECT enabled,pixel_id,capi_token_ciphertext,graph_api_version,test_event_code,version,updated_at,updated_by FROM meta_settings WHERE id=1${forUpdate ? " FOR UPDATE" : ""}`;
  const result = client ? await client.query<Row>(sql) : await query<Row>(sql);
  return result.rows[0];
}

export async function metaConfig(client?: PoolClient): Promise<MetaRuntimeConfig> {
  const row = await findRow(client);
  return row ? runtimeFromRow(row) : environmentMetaConfig();
}

export async function adminMetaSettings() {
  const config = await metaConfig();
  const counts = await query<{pending:number;failed:number;sent:number}>(`SELECT
    count(*) FILTER (WHERE status='pending')::int AS pending,
    count(*) FILTER (WHERE status='failed')::int AS failed,
    count(*) FILTER (WHERE status='sent')::int AS sent FROM meta_event_outbox WHERE pixel_id=$1 AND test_event_code=$2`, [config.pixelId,config.testEventCode]);
  return { source: config.source, enabled: config.requestedEnabled, active: config.enabled, pixelId: config.pixelId,
    hasToken: config.tokenReady, tokenUnreadable: config.tokenUnreadable, graphApiVersion: config.version,
    testEventCode: config.testEventCode, version: config.settingsVersion, updatedAt: config.updatedAt, summary: counts.rows[0] };
}

export async function saveMetaSettings(input: z.infer<typeof metaSettingsSchema>, actorId: string) {
  return transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('kulinerkit:meta_settings'))");
    const row = await findRow(client, true);
    const previous = row ? runtimeFromRow(row) : environmentMetaConfig();
    if (input.version !== previous.settingsVersion) throw new DomainError(409, "META_SETTINGS_CHANGED", "Pengaturan Meta berubah. Muat ulang halaman sebelum menyimpan.");
    const replacement = input.capiToken?.trim();
    let ciphertext = input.clearToken ? null : row?.capi_token_ciphertext || null;
    if (replacement) ciphertext = encryptMetaToken(replacement);
    else if (!row && !input.clearToken && previous.token) ciphertext = encryptMetaToken(previous.token);
    const effectiveToken = input.clearToken ? "" : replacement || previous.token;
    const validToken = Boolean(ciphertext) && Boolean(effectiveToken) && !effectiveToken.includes("CHANGE_ME");
    if (input.enabled && !validToken) throw new DomainError(422, "META_TOKEN_REQUIRED", "Isi token CAPI yang valid sebelum mengaktifkan tracking.");
    if (input.enabled && !pixelPattern.test(input.pixelId)) throw new DomainError(422, "META_PIXEL_REQUIRED", "Isi Pixel ID yang valid.");
    if (row) await client.query(`UPDATE meta_settings SET enabled=$1,pixel_id=$2,capi_token_ciphertext=$3,graph_api_version=$4,
      test_event_code=$5,version=version+1,updated_by=$6,updated_at=now() WHERE id=1`,
      [input.enabled, input.pixelId, ciphertext, input.graphApiVersion, input.testEventCode, actorId]);
    else await client.query(`INSERT INTO meta_settings(id,enabled,pixel_id,capi_token_ciphertext,graph_api_version,test_event_code,updated_by)
      VALUES(1,$1,$2,$3,$4,$5,$6)`,[input.enabled, input.pixelId, ciphertext, input.graphApiVersion, input.testEventCode, actorId]);
    // Events captured for a prior dataset or test mode must never be sent under new settings.
    if (!input.enabled || previous.pixelId !== input.pixelId || previous.testEventCode !== input.testEventCode) {
      await client.query("UPDATE meta_event_outbox SET status='cancelled',payload=NULL WHERE status IN ('pending','failed')");
    }
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'meta_settings','meta',$2)",
      [actorId, `${input.enabled ? "enabled" : "disabled"}; pixel ${input.pixelId || "none"}; test ${input.testEventCode ? "on" : "off"}`]);
    return { message: "Pengaturan Meta tersimpan.", version: previous.settingsVersion + 1 };
  });
}

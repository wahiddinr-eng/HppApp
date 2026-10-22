import { metaSettingsSchema, adminMetaSettings, saveMetaSettings, metaConfig } from "@/server/meta-settings";
import { transaction } from "@/server/db";
import { apiError, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export async function GET(request: Request) {
  try { await requireActor(request, "admin"); return privateJson(await adminMetaSettings()); }
  catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-meta:${actor.id}`, 10, 60);
    const parsed = metaSettingsSchema.safeParse(await readJson(request, 8192));
    if (!parsed.success) throw new DomainError(422, "INVALID_META_SETTINGS", parsed.error.issues[0]?.message || "Pengaturan Meta tidak valid.");
    return privateJson(await saveMetaSettings(parsed.data, actor.id));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-meta-retry:${actor.id}`, 2, 3600);
    const body = await readJson(request, 512);
    if (!body || typeof body !== "object" || (body as {action?:unknown}).action !== "retry_failed")
      throw new DomainError(422, "INVALID_ACTION", "Tindakan tidak valid.");
    const config = await metaConfig();
    if (!config.enabled) throw new DomainError(422, "META_DISABLED", "Aktifkan Meta dan lengkapi token sebelum mencoba ulang.");
    const count = await transaction(async client => {
      const result = await client.query(`UPDATE meta_event_outbox SET status='pending',attempts=0,next_attempt=now(),last_error=NULL
        WHERE status='failed' AND pixel_id=$1 AND test_event_code=$2 AND payload IS NOT NULL AND event_time>now()-interval '6 days' RETURNING id`, [config.pixelId,config.testEventCode]);
      await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'meta_retry','meta',$2)", [actor.id, `${result.rowCount || 0} event`]);
      return result.rowCount || 0;
    });
    return privateJson({ message: count ? `${count} event dijadwalkan ulang.` : "Tidak ada event gagal yang memenuhi syarat untuk diulang." });
  } catch (error) { return apiError(error); }
}

import { z } from "zod";
import { channelSettingsSchema, defaultChannels } from "@/lib/channel-pricing";
import { outputLabel } from "@/lib/hpp";
import { getCalculation, getReport } from "@/server/calculations";
import { query } from "@/server/db";
import { apiError, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

type Context = { params: Promise<{ id: string }> };

async function ownedReport(ownerId: string, id: string) {
  const calculation = await getCalculation(ownerId, id);
  if (calculation.revision < 1) throw new DomainError(422, "REPORT_REQUIRED", "Hitung dan simpan resep sebelum mengatur harga kanal.");
  return getReport(ownerId, id, calculation.revision);
}

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const report = await ownedReport(actor.id, id);
    const result = await query<{ settings: unknown }>("SELECT settings FROM channel_price_settings WHERE calculation_id=$1 AND owner_id=$2", [id, actor.id]);
    const settings = result.rows[0] ? channelSettingsSchema.parse(result.rows[0].settings) : defaultChannels(report.calculation.margin, report.calculation.rounding);
    return privateJson({ calculation: { id, name: report.calculation.name, unit: outputLabel(report.calculation), revision: report.calculation.revision, costPerUnit: report.result.C }, settings });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id } = await context.params;
    await ownedReport(actor.id, id);
    await rateLimit(`channels:${actor.id}`, 30, 60);
    const parsed = z.object({ settings: channelSettingsSchema }).safeParse(await readJson(request, 24 * 1024));
    if (!parsed.success) throw new DomainError(422, "INVALID_CHANNEL_SETTINGS", "Periksa nama kanal, tarif, dan target margin.");
    await query("INSERT INTO channel_price_settings(calculation_id,owner_id,settings) VALUES($1,$2,$3) ON CONFLICT(calculation_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=now() WHERE channel_price_settings.owner_id=EXCLUDED.owner_id", [id, actor.id, JSON.stringify(parsed.data.settings)]);
    return privateJson({ settings: parsed.data.settings });
  } catch (error) { return apiError(error); }
}

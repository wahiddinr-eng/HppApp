import { z } from "zod";
import { getProfitTarget, parseProfitTarget, writeProfitTarget } from "@/server/profit-target";
import { apiError, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export async function GET(request: Request) {
  try { const actor = await requireActor(request); return privateJson(await getProfitTarget(actor.id)); }
  catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    await rateLimit(`profit-target:${actor.id}`, 30, 60);
    const body = z.object({ version: z.number().int().min(0), settings: z.unknown() }).safeParse(await readJson(request, 16 * 1024));
    if (!body.success) throw new DomainError(422, "INVALID_PROFIT_TARGET", "Data target tidak valid.");
    const settings = parseProfitTarget(body.data.settings);
    return privateJson({ saved: await writeProfitTarget(actor.id, settings, body.data.version) });
  } catch (error) { return apiError(error); }
}

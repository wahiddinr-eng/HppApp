import { z } from "zod";
import { getCheckoutSettings } from "@/server/checkout";
import { apiError, checkOrigin, DomainError, readJson } from "@/server/http";
import { enqueuePageMetaEvent, metaConfig } from "@/server/meta";
import { rateLimit } from "@/server/rate-limit";

const eventSchema = z.object({ eventId: z.uuid(), name: z.enum(["ViewContent", "InitiateCheckout"]) });

export async function GET() {
  try {
    const config = await metaConfig();
    return Response.json({ enabled: config.enabled, pixelId: config.enabled ? config.pixelId : null },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!(await metaConfig()).enabled) throw new DomainError(503, "META_DISABLED", "Pelacakan Meta belum diaktifkan.");
    const parsed = eventSchema.safeParse(await readJson(request, 512));
    if (!parsed.success) throw new DomainError(422, "INVALID_META_EVENT", "Event tidak valid.");
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await rateLimit(`meta:ip:${ip}`, 30, 3600);
    const settings = await getCheckoutSettings();
    if (parsed.data.name === "InitiateCheckout" && !settings.enabled) throw new DomainError(422, "CHECKOUT_CLOSED", "Checkout belum dibuka.");
    await enqueuePageMetaEvent(parsed.data.name, parsed.data.eventId, settings.price, request);
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

import { z } from "zod";
import { getCheckoutSettings } from "@/server/checkout";
import { apiError, checkOrigin, DomainError, readJson } from "@/server/http";
import { enqueuePageMetaEvent, metaConfig } from "@/server/meta";
import { rateLimit } from "@/server/rate-limit";
import { getPublishedLandingPage } from "@/server/landing-pages";

const eventSchema = z.object({ eventId: z.uuid(), name: z.enum(["ViewContent", "InitiateCheckout"]),
  pagePath: z.string().regex(/^\/landing\/[a-z0-9]+(?:-[a-z0-9]+)*$/).optional() });

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
    const { pagePath } = parsed.data;
    if (pagePath) {
      if (parsed.data.name !== "ViewContent") throw new DomainError(422, "INVALID_META_EVENT", "URL event tidak valid.");
      const page = await getPublishedLandingPage(pagePath.slice("/landing/".length));
      if (!page?.metaViewContentEnabled) throw new DomainError(422, "LANDING_TRACKING_DISABLED", "ViewContent tidak aktif pada landing page ini.");
    }
    await enqueuePageMetaEvent(parsed.data.name, parsed.data.eventId, settings.price, request, pagePath as `/landing/${string}` | undefined);
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

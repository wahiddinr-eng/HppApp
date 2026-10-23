import { adminPushConfig, adminPushSubscriptionSchema, deleteAdminPushSubscription, saveAdminPushSubscription } from "@/server/admin-push";
import { apiError, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export async function GET(request: Request) {
  try {
    await requireActor(request, "admin");
    const config = adminPushConfig();
    return privateJson({ enabled: Boolean(config), publicKey: config?.publicKey || null });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-push:${actor.id}`, 12, 3600);
    if (!adminPushConfig()) throw new DomainError(503, "PUSH_NOT_CONFIGURED", "Notifikasi belum dikonfigurasi di server.");
    const parsed = adminPushSubscriptionSchema.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new DomainError(422, "INVALID_PUSH_SUBSCRIPTION", "Data langganan notifikasi tidak valid.");
    await saveAdminPushSubscription(actor.id, parsed.data);
    return privateJson({ message: "Notifikasi pesanan aktif di perangkat ini." });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-push:${actor.id}`, 12, 3600);
    const body = await readJson(request, 4096);
    const endpoint = typeof body === "object" && body !== null && "endpoint" in body ? body.endpoint : null;
    const parsed = adminPushSubscriptionSchema.shape.endpoint.safeParse(endpoint);
    if (!parsed.success) throw new DomainError(422, "INVALID_PUSH_SUBSCRIPTION", "Endpoint notifikasi tidak valid.");
    await deleteAdminPushSubscription(actor.id, parsed.data);
    return privateJson({ message: "Notifikasi pesanan dimatikan di perangkat ini." });
  } catch (error) { return apiError(error); }
}

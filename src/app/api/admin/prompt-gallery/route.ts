import { createPromptCollection, listAdminPromptGallery } from "@/server/admin-prompt-gallery";
import { apiError, checkOrigin, privateJson, readJson, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export async function GET(request: Request) {
  try {
    await requireActor(request, "admin");
    return privateJson(await listAdminPromptGallery(new URL(request.url).searchParams.get("productId") || undefined));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-prompts:${actor.id}`, 30, 60);
    return privateJson({ collection: await createPromptCollection(actor, await readJson(request, 24 * 1024)) }, 201);
  } catch (error) { return apiError(error); }
}

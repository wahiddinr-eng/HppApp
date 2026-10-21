import { parsePromptCardForm, savePromptCard } from "@/server/admin-prompt-gallery";
import { apiError, checkOrigin, privateJson, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-prompts:${actor.id}`, 30, 60);
    const { input, image } = await parsePromptCardForm(request);
    return privateJson({ card: await savePromptCard(actor, input, image) }, 201);
  } catch (error) { return apiError(error); }
}

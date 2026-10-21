import { deletePromptCard, parsePromptCardForm, savePromptCard } from "@/server/admin-prompt-gallery";
import { apiError, checkOrigin, privateJson, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-prompts:${actor.id}`, 30, 60);
    const { id } = await context.params;
    const { input, image } = await parsePromptCardForm(request);
    return privateJson({ card: await savePromptCard(actor, input, image, id) });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "admin");
    await rateLimit(`admin-prompts:${actor.id}`, 30, 60);
    const { id } = await context.params;
    return privateJson(await deletePromptCard(actor, id));
  } catch (error) { return apiError(error); }
}

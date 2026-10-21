import { previewIngredientPrice } from "@/server/ingredients";
import { apiError, checkOrigin, privateJson, readJson, requireActor } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request); const actor = await requireActor(request);
    return privateJson(await previewIngredientPrice(actor.id, (await params).id, await readJson(request, 4096)));
  } catch (error) { return apiError(error); }
}

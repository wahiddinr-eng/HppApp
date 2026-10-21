import { applyIngredientPrice, getIngredient } from "@/server/ingredients";
import { apiError, checkOrigin, privateJson, readJson, requireActor } from "@/server/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const actor = await requireActor(request); return privateJson(await getIngredient(actor.id, (await params).id)); }
  catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request); const actor = await requireActor(request);
    return privateJson(await applyIngredientPrice(actor.id, (await params).id, await readJson(request, 128 * 1024)));
  } catch (error) { return apiError(error); }
}

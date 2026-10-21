import { createIngredient, listIngredients } from "@/server/ingredients";
import { apiError, checkOrigin, privateJson, readJson, requireActor } from "@/server/http";

export async function GET(request: Request) {
  try { const actor = await requireActor(request); return privateJson({ items: await listIngredients(actor.id) }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request); const actor = await requireActor(request);
    return privateJson({ ingredient: await createIngredient(actor.id, await readJson(request, 4096)) }, 201);
  } catch (error) { return apiError(error); }
}

import { apiError, privateJson, requireActor } from "@/server/http";
import { listPromptGallery } from "@/server/prompt-gallery";

export async function GET(request: Request) {
  try { return privateJson(await listPromptGallery(await requireActor(request, "session"))); }
  catch (error) { return apiError(error); }
}

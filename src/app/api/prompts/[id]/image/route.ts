import { apiError, requireActor } from "@/server/http";
import { readPromptImage } from "@/server/prompt-gallery";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { bytes, mime } = await readPromptImage(await requireActor(request, "session"), id);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": mime, "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return apiError(error); }
}

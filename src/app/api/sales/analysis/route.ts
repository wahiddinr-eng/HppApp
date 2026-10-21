import { businessToday } from "@/lib/sales";
import { salesAnalysis } from "@/server/sales";
import { apiError, privateJson, requireActor } from "@/server/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const params = new URL(request.url).searchParams;
    const to = params.get("to") || businessToday();
    const from = params.get("from") || new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
    return privateJson(await salesAnalysis(actor.id, from, to));
  } catch (error) { return apiError(error); }
}

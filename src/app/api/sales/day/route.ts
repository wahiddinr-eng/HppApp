import { getSalesDay, saleProducts, saveSalesDay } from "@/server/sales";
import { apiError, checkOrigin, privateJson, readJson, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const date = new URL(request.url).searchParams.get("date") || "";
    const [day, activeProducts] = await Promise.all([getSalesDay(actor.id, date), saleProducts(actor.id)]);
    const products = [...activeProducts];
    for (const channel of day?.channels ?? []) for (const item of channel.items) {
      if (!products.some(product => product.id === item.calculationId))
        products.push({ id: item.calculationId, name: `${item.name} (arsip)`, unit: item.unit,
          revision: item.revision, cost: item.unitCost, price: item.gross });
    }
    return privateJson({ day, products });
  } catch (error) { return apiError(error); }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    await rateLimit(`sales:${actor.id}`, 40, 60);
    return privateJson({ day: await saveSalesDay(actor.id, await readJson(request, 128 * 1024)) });
  } catch (error) { return apiError(error); }
}

import { orderSchema, createCheckoutOrder } from "@/server/checkout";
import { apiError, checkOrigin, DomainError, privateJson, readJson } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { captureMetaContext, metaConfig } from "@/server/meta";
export async function POST(request:Request){try{
  checkOrigin(request);
  const parsed=orderSchema.safeParse(await readJson(request,4096));
  if(!parsed.success)throw new DomainError(422,"INVALID_ORDER",parsed.error.issues.find(issue=>issue.path[0]==="phone")?.message||"Isi nama, email, nomor HP, dan metode pembayaran yang valid.");
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  await rateLimit(`checkout:ip:${ip}`,6,3600);
  await rateLimit(`checkout:email:${parsed.data.email}`,3,3600);
  const order=await createCheckoutOrder(parsed.data,(await metaConfig()).enabled?captureMetaContext(request):{});
  return privateJson(order,201);
}catch(error){return apiError(error);}}

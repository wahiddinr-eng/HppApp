import { receivePurchase } from "@/server/purchases";
import { apiError, checkConfigured, DomainError, privateJson, readBody } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
export const runtime="nodejs";
export async function POST(request:Request){try{
  checkConfigured();if(!request.headers.get("content-type")?.startsWith("application/json"))throw new DomainError(415,"CONTENT_TYPE","Gunakan Content-Type application/json.");
  const raw=await readBody(request);
  await rateLimit("webhook:"+request.headers.get("x-hpp-key-id"),120,60);
  const result=await receivePurchase(raw,request.headers);return privateJson({code:result.code},result.status);
}catch(error){return apiError(error);}}

import { auth } from "@/server/auth";
import { checkConfigured, apiError, DomainError,checkOrigin,readBody } from "@/server/http";

export const runtime = "nodejs";

async function handle(request: Request) {
  try {
    checkConfigured();
    const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
    if (!["/sign-in/email","/sign-out","/get-session","/change-password"].includes(path)) throw new DomainError(403,"AUTH_ENDPOINT_DISABLED","Endpoint akun ini tidak tersedia.");
    if(request.method==="POST"){
      checkOrigin(request);const body=await readBody(request,8192);
      return await auth.handler(new Request(request.url,{method:"POST",headers:request.headers,body:new Uint8Array(body)}));
    }
    return await auth.handler(request);
  }
  catch (error) { return apiError(error); }
}
export const GET = handle;
export const POST = handle;

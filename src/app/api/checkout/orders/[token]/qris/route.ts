import { findCheckoutOrder } from "@/server/checkout";
import { readQrisImage } from "@/server/checkout-media";
import { apiError, DomainError } from "@/server/http";
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){try{
  const {token}=await params;
  const order=await findCheckoutOrder(token);
  if(order.payment_method!=="qris")throw new DomainError(404,"QRIS_NOT_FOUND","Gambar QRIS tidak ditemukan.");
  const {imageKey,imageMime}=order.payment_snapshot as {imageKey:string;imageMime:string};
  const bytes=await readQrisImage(imageKey,imageMime);
  return new Response(new Uint8Array(bytes),{headers:{"Content-Type":imageMime,"Cache-Control":"private, no-store","Content-Disposition":"inline; filename=qris-kulinerkit"}});
}catch(error){return apiError(error);}}

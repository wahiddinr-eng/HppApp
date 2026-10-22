import { getCheckoutSettings } from "@/server/checkout";
import { readQrisImage } from "@/server/checkout-media";
import { apiError,DomainError,requireActor } from "@/server/http";
export async function GET(request:Request){try{
  await requireActor(request,"admin");const settings=await getCheckoutSettings();
  if(!settings.qris_image_key||!settings.qris_image_mime)throw new DomainError(404,"QRIS_NOT_FOUND","Gambar QRIS belum diunggah.");
  const bytes=await readQrisImage(settings.qris_image_key,settings.qris_image_mime);
  return new Response(new Uint8Array(bytes),{headers:{"Content-Type":settings.qris_image_mime,"Cache-Control":"private, no-store"}});
}catch(error){return apiError(error);}}

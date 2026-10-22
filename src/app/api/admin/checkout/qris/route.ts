import { storeQrisImage } from "@/server/checkout-media";
import { transaction } from "@/server/db";
import { apiError,checkOrigin,DomainError,privateJson,readBody,requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
export async function POST(request:Request){try{
  checkOrigin(request);const actor=await requireActor(request,"admin");await rateLimit(`admin-qris:${actor.id}`,10,3600);
  const bytes=await readBody(request,9*1024*1024);
  const form=await new Request("http://local/upload",{method:"POST",headers:{"content-type":request.headers.get("content-type")||""},body:bytes}).formData();
  const file=form.get("image");if(!(file instanceof File))throw new DomainError(422,"IMAGE_REQUIRED","Pilih gambar QRIS.");
  const image=await storeQrisImage(new Uint8Array(await file.arrayBuffer()));
  await transaction(async client=>{
    await client.query("UPDATE checkout_settings SET qris_image_key=$1,qris_image_mime=$2,updated_at=now() WHERE id=1",[image.key,image.mime]);
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'checkout_qris_updated','checkout',$2)",[actor.id,image.key]);
  });
  return privateJson({message:"Gambar QRIS disimpan.",...image});
}catch(error){return apiError(error);}}

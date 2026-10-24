import { z } from "zod";
import { query } from "@/server/db";
import { testimonialSchema } from "@/server/landing-testimonials";
import { apiError,checkOrigin,DomainError,privateJson,readJson,requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export async function GET(request:Request){try{await requireActor(request,"admin");const result=await query("SELECT id,customer_name,business_name,quote,consent_confirmed,published,sort_order,created_at,updated_at FROM landing_testimonial ORDER BY sort_order,created_at");return privateJson(result.rows);}catch(error){return apiError(error);}}

async function save(request:Request,method:"POST"|"PUT"){
  try{
    checkOrigin(request);const actor=await requireActor(request,"admin");await rateLimit(`admin-testimonials:${actor.id}`,30,60);
    const parsed=testimonialSchema.safeParse(await readJson(request,4096));
    if(!parsed.success)throw new DomainError(422,"INVALID_TESTIMONIAL",parsed.error.issues[0]?.message||"Testimoni tidak valid.");
    const value=parsed.data;
    if(method==="PUT"&&!value.id)throw new DomainError(422,"ID_REQUIRED","Pilih testimoni yang ingin diubah.");
    const result=method==="POST"
      ?await query<{id:string}>("INSERT INTO landing_testimonial(customer_name,business_name,quote,consent_confirmed,published,sort_order) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",[value.customerName,value.businessName,value.quote,value.consentConfirmed,value.published,value.sortOrder])
      :await query<{id:string}>("UPDATE landing_testimonial SET customer_name=$2,business_name=$3,quote=$4,consent_confirmed=$5,published=$6,sort_order=$7,updated_at=now() WHERE id=$1 RETURNING id",[value.id,value.customerName,value.businessName,value.quote,value.consentConfirmed,value.published,value.sortOrder]);
    if(!result.rows[0])throw new DomainError(404,"TESTIMONIAL_NOT_FOUND","Testimoni tidak ditemukan.");
    await query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,$2,$3,$4)",[actor.id,method==="POST"?"testimonial_created":"testimonial_updated",result.rows[0].id,value.published?"published":"draft"]);
    return privateJson({id:result.rows[0].id});
  }catch(error){return apiError(error);}
}
export async function POST(request:Request){return save(request,"POST");}
export async function PUT(request:Request){return save(request,"PUT");}
export async function DELETE(request:Request){try{
  checkOrigin(request);const actor=await requireActor(request,"admin");await rateLimit(`admin-testimonials:${actor.id}`,30,60);
  const id=z.uuid().safeParse(new URL(request.url).searchParams.get("id"));if(!id.success)throw new DomainError(422,"INVALID_ID","ID testimoni tidak valid.");
  const result=await query("DELETE FROM landing_testimonial WHERE id=$1 RETURNING id",[id.data]);if(!result.rowCount)throw new DomainError(404,"TESTIMONIAL_NOT_FOUND","Testimoni tidak ditemukan.");
  await query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'testimonial_deleted',$2,'admin')",[actor.id,id.data]);return privateJson({message:"Testimoni dihapus."});
}catch(error){return apiError(error);}}

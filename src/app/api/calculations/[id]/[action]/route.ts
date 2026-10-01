import { z } from "zod";
import { query } from "@/server/db";
import { checkId, createCalculation, finalizeCalculation, getCalculation } from "@/server/calculations";
import { toApiInput } from "@/lib/input";
import { apiError, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
export async function POST(request:Request,{params}:{params:Promise<{id:string;action:string}>}){try{
  checkOrigin(request);const actor=await requireActor(request);const {id,action}=await params;checkId(id);
  if(action==="finalize"){
    const parsed=z.object({expected_draft_version:z.number().int().positive(),request_id:z.uuid()}).safeParse(await readJson(request,4096));
    if(!parsed.success)throw new DomainError(422,"INVALID_INPUT","Versi draft dan request ID diperlukan.");
    return privateJson(await finalizeCalculation(actor.id,id,parsed.data.expected_draft_version,parsed.data.request_id));
  }
  if(action==="duplicate"){
    const current=await getCalculation(actor.id,id);const input=toApiInput(current);input.name=input.name.slice(0,112)+" Salinan";
    return privateJson({calculation:await createCalculation(actor.id,input)},201);
  }
  if(action==="archive"){
    const parsed=z.object({archived:z.boolean()}).safeParse(await readJson(request,4096));if(!parsed.success)throw new DomainError(422,"INVALID_INPUT","Status arsip diperlukan.");
    await getCalculation(actor.id,id);await query("UPDATE calculation SET archived=$3,updated_at=now() WHERE id=$1 AND owner_id=$2",[id,actor.id,parsed.data.archived]);
    return privateJson({message:parsed.data.archived?"Perhitungan diarsipkan.":"Perhitungan dipulihkan."});
  }
  throw new DomainError(404,"NOT_FOUND","Endpoint tidak ditemukan.");
}catch(error){return apiError(error);}}

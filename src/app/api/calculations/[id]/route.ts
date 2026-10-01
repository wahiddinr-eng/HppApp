import { z } from "zod";
import { getCalculation, parseInput, saveDraft } from "@/server/calculations";
import { apiError, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await requireActor(request);return privateJson({calculation:await getCalculation(actor.id,(await params).id)});}catch(error){return apiError(error);}}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{
  checkOrigin(request);const actor=await requireActor(request);
  const parsed=z.object({schema_version:z.literal("1"),expected_draft_version:z.number().int().positive(),input:z.unknown()}).safeParse(await readJson(request));
  if(!parsed.success)throw new DomainError(422,"INVALID_INPUT","Versi draft dan input diperlukan.");
  return privateJson({calculation:await saveDraft(actor.id,(await params).id,parseInput(parsed.data.input),parsed.data.expected_draft_version)});
}catch(error){return apiError(error);}}

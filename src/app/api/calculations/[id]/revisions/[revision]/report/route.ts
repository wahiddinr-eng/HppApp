import { getReport } from "@/server/calculations";
import { apiError, privateJson, requireActor } from "@/server/http";
export async function GET(request:Request,{params}:{params:Promise<{id:string;revision:string}>}){try{
  const actor=await requireActor(request);const {id,revision}=await params;return privateJson(await getReport(actor.id,id,Number(revision)));
}catch(error){return apiError(error);}}

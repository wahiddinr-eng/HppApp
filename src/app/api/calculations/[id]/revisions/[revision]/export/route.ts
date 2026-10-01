import { getReport } from "@/server/calculations";
import { exportExcel, exportFilename, exportPdf } from "@/server/export";
import { apiError, DomainError, requireActor } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string;revision:string}>}){try{
  const actor=await requireActor(request);await rateLimit("export:"+actor.id,15,60);const {id,revision}=await params;
  const format=new URL(request.url).searchParams.get("format");if(format!=="pdf"&&format!=="xlsx")throw new DomainError(422,"INVALID_FORMAT","Pilih PDF atau XLSX.");
  const snapshot=await getReport(actor.id,id,Number(revision));const bytes=format==="pdf"?await exportPdf(snapshot):await exportExcel(snapshot);
  return new Response(new Uint8Array(bytes),{headers:{"Content-Type":format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":'attachment; filename="'+exportFilename(snapshot,format)+'"',"Cache-Control":"private, no-store"}});
}catch(error){return apiError(error);}}

import { query } from "@/server/db";
import { clientCalculation, createCalculation, parseInput, type CalculationRow } from "@/server/calculations";
import { apiError, checkOrigin, DomainError, privateJson, readJson, requireActor } from "@/server/http";
export async function GET(request:Request){try{
  const actor=await requireActor(request);const url=new URL(request.url);
  const search=(url.searchParams.get("search")||"").slice(0,120);const status=url.searchParams.get("status")||"active";
  const page=Math.floor(Math.max(1,Math.min(10000,Number(url.searchParams.get("page"))||1)));
  const params=[actor.id,status==="archived","%"+search+"%"];
  const where="owner_id=$1 AND archived=$2 AND (name ILIKE $3 OR draft_input->>'business' ILIKE $3)"+(status==="final"?" AND latest_revision > 0":"");
  const rows=await query<CalculationRow>("SELECT * FROM calculation WHERE "+where+" ORDER BY updated_at DESC LIMIT 20 OFFSET $4",[...params,(page-1)*20]);
  const count=await query<{count:string}>("SELECT count(*) FROM calculation WHERE "+where,params);
  const stats=await query("SELECT count(*) FILTER(WHERE NOT c.archived)::int AS active,count(*) FILTER(WHERE NOT c.archived AND c.state='final')::int AS final,COALESCE(avg((r.result->>'C')::numeric) FILTER(WHERE NOT c.archived AND c.state='final'),0)::text AS average FROM calculation c LEFT JOIN calculation_revision r ON r.calculation_id=c.id AND r.revision=c.latest_revision WHERE c.owner_id=$1",[actor.id]);
  return privateJson({items:rows.rows.map(clientCalculation),total:Number(count.rows[0].count),page,stats:stats.rows[0]});
}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
  checkOrigin(request);const actor=await requireActor(request);const parsed=z.object({schema_version:z.literal("1"),input:z.unknown()}).safeParse(await readJson(request));
  if(!parsed.success)throw new DomainError(422,"SCHEMA_VERSION","Versi schema dan input diperlukan.");
  return privateJson({calculation:await createCalculation(actor.id,parseInput(parsed.data.input))},201);
}catch(error){return apiError(error);}}
import {z} from "zod";

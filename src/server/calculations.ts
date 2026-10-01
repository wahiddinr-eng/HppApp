import Decimal from "decimal.js";
import { z } from "zod";
import { calculate, validate, type Calculation } from "../lib/hpp";
import { inputSchema, toFormInput, type CalculationInput } from "../lib/input";
import { query, transaction } from "./db";
import { DomainError } from "./http";

export type CalculationRow = {id:string;owner_id:string;draft_input:CalculationInput;draft_version:number;name:string;state:"draft"|"final";latest_revision:number;archived:boolean;updated_at:Date};
export function clientCalculation(row:CalculationRow):Calculation { return {...toFormInput(row.draft_input),id:row.id,state:row.state,revision:row.latest_revision,draftVersion:row.draft_version,archived:row.archived,updatedAt:new Date(row.updated_at).toISOString()}; }
export const checkId = (id:string) => { if(!z.uuid().safeParse(id).success) throw new DomainError(404,"NOT_FOUND","Perhitungan tidak ditemukan."); };

export function parseInput(value:unknown):CalculationInput {
  const parsed=inputSchema.safeParse(value);
  if(!parsed.success) throw new DomainError(422,"INVALID_INPUT","Format perhitungan tidak valid.",Object.fromEntries(parsed.error.issues.map(issue=>[issue.path.join("."),issue.message])));
  return parsed.data;
}
export function snapshotResult(input:CalculationInput) {
  const form=toFormInput(input);
  const fields=validate(form);
  const canonicalPattern=/^\d+(\.\d+)?$/;
  const numbers=[input.batch,input.margin,...input.ingredients.flatMap(row=>row.name||row.quantity||row.price?[row.quantity,row.price]:[]),...input.packages.flatMap(row=>[row.quantity,row.price]),...input.labor.flatMap(row=>[row.people,row.wage]),...input.others.map(row=>row.amount),...(input.taxEnabled?[input.taxRate]:[]),...(input.manualPrice?[input.manualPrice]:[])];
  if(numbers.some(value=>!canonicalPattern.test(value))) fields.number_format="Angka API harus berupa decimal string tanpa pemisah ribuan.";
  if(Object.keys(fields).length) throw new DomainError(422,"VALIDATION_FAILED","Lengkapi kolom perhitungan.",fields);
  const result=calculate(form);
  return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,value instanceof Decimal?value.toFixed():value]));
}

export async function createCalculation(owner:string,input:CalculationInput) {
  const result=await query<CalculationRow>("INSERT INTO calculation(owner_id,draft_input,name) VALUES($1,$2,$3) RETURNING *",[owner,JSON.stringify({schema_version:"1",...input}),input.name]);
  return clientCalculation(result.rows[0]);
}
export async function getCalculation(owner:string,id:string) {
  checkId(id);
  const result=await query<CalculationRow>("SELECT * FROM calculation WHERE id=$1 AND owner_id=$2",[id,owner]);
  if(!result.rows[0]) throw new DomainError(404,"NOT_FOUND","Perhitungan tidak ditemukan.");
  return clientCalculation(result.rows[0]);
}
export async function saveDraft(owner:string,id:string,input:CalculationInput,expected:number) {
  checkId(id);
  const result=await query<CalculationRow>("UPDATE calculation SET draft_input=$3,name=$4,state='draft',draft_version=draft_version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 AND draft_version=$5 RETURNING *",[id,owner,JSON.stringify({schema_version:"1",...input}),input.name,expected]);
  if(!result.rows[0]) { await getCalculation(owner,id); throw new DomainError(409,"DRAFT_CONFLICT","Draft telah diubah di tab lain. Muat ulang atau simpan sebagai perhitungan baru."); }
  return clientCalculation(result.rows[0]);
}
export async function finalizeCalculation(owner:string,id:string,expected:number,requestId:string) {
  checkId(id);
  return transaction(async client=>{
    const result=await client.query<CalculationRow>("SELECT * FROM calculation WHERE id=$1 AND owner_id=$2 FOR UPDATE",[id,owner]);
    const row=result.rows[0];
    if(!row) throw new DomainError(404,"NOT_FOUND","Perhitungan tidak ditemukan.");
    const prior=await client.query("SELECT revision,draft_version FROM finalize_request WHERE calculation_id=$1 AND request_id=$2",[id,requestId]);
    if(prior.rows[0]) {
      if(prior.rows[0].draft_version!==expected) throw new DomainError(409,"REQUEST_ID_CONFLICT","ID permintaan telah dipakai untuk draft berbeda.");
      return {revision:prior.rows[0].revision,calculation:{...clientCalculation(row),revision:prior.rows[0].revision}};
    }
    if(row.draft_version!==expected) throw new DomainError(409,"DRAFT_CONFLICT","Draft telah berubah. Muat versi terbaru.");
    const input=parseInput(row.draft_input);
    const snapshot=snapshotResult(input);
    const revision=row.latest_revision+1;
    await client.query("INSERT INTO calculation_revision(calculation_id,revision,input,result) VALUES($1,$2,$3,$4)",[id,revision,JSON.stringify(input),JSON.stringify(snapshot)]);
    await client.query("INSERT INTO finalize_request(calculation_id,request_id,draft_version,revision) VALUES($1,$2,$3,$4)",[id,requestId,expected,revision]);
    const saved=await client.query<CalculationRow>("UPDATE calculation SET state='final',latest_revision=$2,updated_at=now() WHERE id=$1 RETURNING *",[id,revision]);
    return {revision,calculation:clientCalculation(saved.rows[0])};
  });
}
export async function getReport(owner:string,id:string,revision:number) {
  checkId(id);
  if(!Number.isInteger(revision)||revision<1)throw new DomainError(404,"NOT_FOUND","Revisi tidak ditemukan.");
  const result=await query("SELECT r.*,c.archived,c.owner_id FROM calculation_revision r JOIN calculation c ON c.id=r.calculation_id WHERE c.id=$1 AND c.owner_id=$2 AND r.revision=$3",[id,owner,revision]);
  const row=result.rows[0];
  if(!row) throw new DomainError(404,"NOT_FOUND","Revisi report tidak ditemukan.");
  return {calculation:{...toFormInput(row.input),id,state:"final" as const,revision,archived:row.archived,updatedAt:new Date(row.created_at).toISOString()},input:row.input as CalculationInput,result:row.result as Record<string,unknown>,formula_version:row.formula_version,schema_version:row.schema_version};
}

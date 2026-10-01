"use client";
import {useCallback,useEffect,useState,useRef} from "react";
import type {Calculation} from "./hpp";
import {toApiInput} from "./input";
import {api} from "./api";
const EVENT="hpp-store-updated";
export type ListStats={active:number;final:number;average:string};
type List={items:Calculation[];total:number;page:number;stats:ListStats};
const changed=()=>window.dispatchEvent(new Event(EVENT));
export async function readCalculation(id:string){return (await api<{calculation:Calculation}>("/api/calculations/"+id)).calculation;}
export async function saveCalculation(item:Calculation){
  const path=item.draftVersion?"/api/calculations/"+item.id:"/api/calculations";
  const body={schema_version:"1",input:toApiInput(item),...(item.draftVersion?{expected_draft_version:item.draftVersion}:{})};
  const response=await api<{calculation:Calculation}>(path,{method:item.draftVersion?"PATCH":"POST",body:JSON.stringify(body)});changed();return response.calculation;
}
export async function finalizeRemote(item:Calculation,requestId:string){
  const result=await api<{calculation:Calculation;revision:number}>("/api/calculations/"+item.id+"/finalize",{method:"POST",body:JSON.stringify({expected_draft_version:item.draftVersion,request_id:requestId})});changed();return {...result.calculation,revision:result.revision};
}
export async function duplicateCalculation(id:string){const result=await api<{calculation:Calculation}>("/api/calculations/"+id+"/duplicate",{method:"POST",body:"{}"});changed();return result.calculation;}
export async function archiveCalculation(id:string,archived:boolean){await api("/api/calculations/"+id+"/archive",{method:"POST",body:JSON.stringify({archived})});changed();}
export async function readReportCalculation(id:string,revision?:number){
  const selected=revision??(await readCalculation(id)).revision;
  if(!selected)return undefined;
  const report=await api<{calculation:Calculation;result:Record<string,unknown>}>("/api/calculations/"+id+"/revisions/"+selected+"/report");
  return {...report.calculation,resultSnapshot:report.result};
}
export function useCalculations(options:{search?:string;status?:string;page?:number}={}){
  const search=options.search||"";const status=options.status||"active";const page=options.page||1;
  const [items,setItems]=useState<Calculation[]>([]);const [ready,setReady]=useState(false);const [error,setError]=useState("");
  const [total,setTotal]=useState(0);const [stats,setStats]=useState<ListStats>({active:0,final:0,average:"0"});
  const sequence=useRef(0);
  const refresh=useCallback(async()=>{
    const current=++sequence.current;
    try{const result=await api<List>("/api/calculations?"+new URLSearchParams({search,status,page:String(page)}));if(current!==sequence.current)return;setItems(result.items);setTotal(result.total);setStats(result.stats);setError("");}
    catch(error){if(current===sequence.current)setError(error instanceof Error?error.message:"Gagal memuat perhitungan.");}
    finally{if(current===sequence.current)setReady(true);}
  },[search,status,page]);
  useEffect(()=>{sequence.current++;const timer=window.setTimeout(()=>void refresh(),200);const listener=()=>void refresh();window.addEventListener(EVENT,listener);return()=>{sequence.current++;window.clearTimeout(timer);window.removeEventListener(EVENT,listener);};},[refresh]);
  return {items,ready,error,total,stats,refresh};
}

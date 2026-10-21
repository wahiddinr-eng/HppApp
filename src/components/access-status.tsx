"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {api} from "@/lib/api";
import {PageTop,Shell} from "./shell";
type Access={user:{status:string};active:boolean;features:string[];grants:{id:string;status:string;created_at:string}[]};
export function AccessStatus({support}:{support?:string}){
  const [data,setData]=useState<Access>();const [error,setError]=useState("");
  useEffect(()=>{void api<Access>("/api/account/status").then(setData).catch(error=>setError(error.message));},[]);
  return <Shell><PageTop eyebrow="AKUN / AKSES" title="Status akses" description="Akses mengikuti pembelian yang memenuhi syarat."/><div className="access-card">
    <h2>{data?data.active?"Akses aktif":"Belum ada akses aktif":"Memuat status..."}</h2>
    {error&&<p role="alert">{error}</p>}{data&&<><p>Status akun: {data.user.status}. Fitur aktif: {data.features.map(feature=>feature==="hpp_calculator"?"Kalkulator HPP":feature==="prompt_gallery"?"Galeri Prompt":feature).join(", ")||"belum ada"}.</p><p>Pencabutan satu pembelian tidak mencabut akses dari pembelian lain yang masih aktif.</p></>}
    {data?.features.includes("hpp_calculator")&&<Link href="/app/calculations" className="button primary">Buka perhitungan</Link>}
    {data?.features.includes("prompt_gallery")&&<Link href="/app/prompts" className="button primary">Buka Galeri Prompt</Link>}
    {support&&<a className="button secondary" href={support} rel="noopener noreferrer" target="_blank">Hubungi bantuan</a>}
  </div></Shell>;
}

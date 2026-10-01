"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {api} from "@/lib/api";
import {PageTop,Shell} from "./shell";
type Grant={id:string;source:string;purchase_id:string;product_id:string;status:string;reason:string|null};
type Account={id:string;email:string;name:string;account_status:string;grants:Grant[]};
type Job={id:string;source?:string;event_id?:string;purchase_id?:string;kind?:string;recipient?:string;status:string;stage?:string;attempts:number;last_error:string|null;next_attempt:string};
type Data={accounts?:Account[];events?:Job[];emails?:Job[];worker?:{name:string;last_seen:string}[]};
export function AdminPreview({area}:{area:"access"|"integrations"}){
  const [data,setData]=useState<Data>();const [search,setSearch]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{try{setData(await api<Data>("/api/admin/"+area+"?"+new URLSearchParams({search})));}catch(error){setNotice(error instanceof Error?error.message:"Gagal memuat.");}},[area,search]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),250);return()=>clearTimeout(timer);},[load]);
  const act=async(action:string,id:string,kind?:string)=>{
    const reason=window.prompt("Tuliskan alasan tindakan (minimal 5 karakter). Semua tindakan diaudit.");
    if(reason===null)return;if(reason.trim().length<5){setNotice("Alasan minimal 5 karakter.");return;}
    setBusy(true);setNotice("");
    try{const result=await api<{message:string}>("/api/admin/"+area,{method:"POST",body:JSON.stringify({action,id,reason,kind})});setNotice(result.message);await load();}
    catch(error){setNotice(error instanceof Error?error.message:"Tindakan gagal.");}finally{setBusy(false);}
  };
  const jobs=(rows:Job[]|undefined,kind:"webhook"|"email")=><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{kind==="webhook"?"Event / pembelian":"Email / penerima"}</th><th>Status</th><th>Percobaan</th><th>Detail</th><th>Tindakan</th></tr></thead><tbody>
    {rows?.map(row=><tr key={row.id}><td>{kind==="webhook"?<>{row.source}<br/>{row.event_id}<br/>{row.purchase_id}</>:<>{row.kind}<br/>{row.recipient}</>}</td><td>{row.status}</td><td>{row.attempts}</td><td>{row.stage||row.last_error||"—"}</td><td>{row.status==="failed"&&<button className="button secondary" disabled={busy} onClick={()=>void act("retry",row.id,kind)}>Proses ulang</button>}</td></tr>)}
    {!rows?.length&&<tr><td colSpan={5}>Belum ada job.</td></tr>}
  </tbody></table></div>;
  return <Shell><PageTop eyebrow={"ADMIN / "+area.toUpperCase()} title={area==="access"?"Pengelolaan akses":"Pemantauan integrasi"} description="Tindakan administratif dicatat dalam audit log. Resep pengguna tidak ditampilkan." actions={<><Link href="/admin/access" className="button secondary">Akses</Link><Link href="/admin/integrations" className="button secondary">Integrasi</Link><button className="button secondary" onClick={()=>void load()}>Muat ulang</button></>}/>
    {notice&&<div className="form-message" role="status">{notice}</div>}
    {area==="access"?<><label className="search-box"><span>Cari email</span><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="nama@email.com"/></label>
      {!data&&<p>Memuat akun...</p>}{data?.accounts?.map(user=><section className="panel admin-account" key={user.id}><div className="panel-head"><div><h2>{user.email}</h2><p>{user.name} · {user.account_status}</p></div>{user.account_status==="pending_activation"&&<button disabled={busy} className="button secondary" onClick={()=>void act("resend_activation",user.id)}>Kirim ulang aktivasi</button>}</div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Sumber / pembelian</th><th>Produk</th><th>Status</th><th>Alasan</th><th>Tindakan</th></tr></thead><tbody>{user.grants.map(grant=><tr key={grant.id}><td>{grant.source}<br/>{grant.purchase_id}</td><td>{grant.product_id}</td><td>{grant.status}</td><td>{grant.reason||"—"}</td><td><button disabled={busy} className="button secondary" onClick={()=>void act(grant.status==="active"?"revoke":"restore",grant.id)}>{grant.status==="active"?"Cabut akses":"Pulihkan akses"}</button></td></tr>)}{!user.grants.length&&<tr><td colSpan={5}>Tidak ada grant.</td></tr>}</tbody></table></div></section>)}
      {data?.accounts?.length===0&&<p>Akun tidak ditemukan.</p>}<p className="field-help">Maksimal 50 akun per pencarian. Pengiriman ulang aktivasi dibatasi sekali per 10 menit.</p></>:
      <><section className="panel admin-account"><div className="panel-head"><h2>Kesehatan worker</h2></div><div className="section-body">{data?.worker?.length?data.worker.map(worker=><p key={worker.name}>{worker.name}: {new Date(worker.last_seen).toLocaleString("id-ID",{timeZone:"Asia/Makassar"})} WITA {Date.now()-new Date(worker.last_seen).getTime()>60000?"· Periksa worker":"· Aktif"}</p>):<p>Worker belum mengirim heartbeat. Jalankan proses worker terpisah.</p>}</div></section><section className="panel admin-account"><div className="panel-head"><h2>Inbox webhook</h2></div>{jobs(data?.events,"webhook")}</section><section className="panel admin-account"><div className="panel-head"><h2>Outbox email</h2></div>{jobs(data?.emails,"email")}</section><p className="field-help">100 job terbaru. Status review membutuhkan pemeriksaan manual; tidak memberikan akses otomatis.</p></>}
  </Shell>;
}

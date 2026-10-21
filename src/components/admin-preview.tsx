"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, Copy, Link2, Mail, RefreshCw, Search, ShieldCheck, Webhook, X } from "lucide-react";
import { api } from "@/lib/api";
import { featureLabel, groupAccessGrants, type AdminGrant } from "@/lib/admin-access";
import { PageTop } from "./shell";
import styles from "./admin-preview.module.css";

type Account = { id:string;email:string;name:string;account_status:string;grants:AdminGrant[] };
type Job = { id:string;source?:string;event_id?:string;purchase_id?:string;kind?:string;recipient?:string;
  status:string;stage?:string;attempts:number;last_error:string|null;created_at:string;next_attempt:string };
type Data = { accounts?:Account[];events?:Job[];emails?:Job[];worker?:{name:string;last_seen:string}[] };
type ActivationLink = {email:string;url:string;expiresAt:string};

const date=(value:string)=>new Date(value).toLocaleString("id-ID",{timeZone:"Asia/Makassar",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const accountStatus=(status:string)=>status==="active"?"Aktif":status==="pending_activation"?"Menunggu aktivasi":status==="suspended"?"Ditangguhkan":status;
const emailKind=(kind:string)=>kind==="activation_request"?"Permintaan aktivasi":kind==="activation"?"Email aktivasi":kind==="password_reset"?"Reset password":kind==="access_given"?"Akses diberikan":kind;
const jobStatus=(job:Job)=>job.status==="sent"?(job.kind==="activation_request"?"Diproses":"Diterima SMTP"):job.status==="processed"?"Selesai":job.status==="failed"?"Gagal":job.status==="pending"?"Menunggu":job.status==="review_required"?"Perlu ditinjau":job.status==="ignored"?"Diabaikan":job.status==="expired"?"Kedaluwarsa":job.status==="cancelled"?"Dibatalkan":job.status;
const stageLabels:Record<string,string>={completed:"Selesai",version_conflict:"Versi pembelian bentrok",older_version:"Versi lama diabaikan",ignored_product:"Produk tidak sesuai",email_changed:"Email pembeli berubah",partial_refund:"Pengembalian sebagian"};
const jobStage=(stage:string|undefined)=>stageLabels[stage||""]||stage;

export function AdminPreview({area}:{area:"access"|"integrations"}){
  const [data,setData]=useState<Data>();
  const [search,setSearch]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [activationLink,setActivationLink]=useState<ActivationLink>();
  const load=useCallback(async()=>{
    setLoading(true);
    try { setData(await api<Data>("/api/admin/"+area+"?"+new URLSearchParams({search}))); }
    catch(error){setNotice(error instanceof Error?error.message:"Gagal memuat data admin.");}
    finally{setLoading(false);}
  },[area,search]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),250);return()=>clearTimeout(timer);},[load]);
  async function act(action:string,id:string,kind?:string){
    const reason=window.prompt(action==="generate_activation_link"?"Alasan membuat tautan aktivasi baru (minimal 5 karakter). Tautan lama akan dibatalkan dan tindakan ini diaudit.":"Tuliskan alasan tindakan (minimal 5 karakter). Semua tindakan diaudit.");
    if(reason===null)return;
    if(reason.trim().length<5){setNotice("Alasan minimal 5 karakter.");return;}
    setBusy(true);setNotice("");
    try { const result=await api<{message:string}&Partial<ActivationLink>>("/api/admin/"+area,{method:"POST",body:JSON.stringify({action,id,reason,kind})});
      if(action==="generate_activation_link"&&result.email&&result.url&&result.expiresAt)setActivationLink({email:result.email,url:result.url,expiresAt:result.expiresAt});
      setNotice(result.message);await load(); }
    catch(error){setNotice(error instanceof Error?error.message:"Tindakan gagal.");}
    finally{setBusy(false);}
  }
  async function copyActivationLink(){
    if(!activationLink)return;
    try { await navigator.clipboard.writeText(activationLink.url);setNotice("Tautan disalin. Kirim hanya kepada pemilik email akun tersebut."); }
    catch { setNotice("Gagal menyalin otomatis. Pilih dan salin tautan pada kotak secara manual."); }
  }
  const jobs=(rows:Job[]|undefined,kind:"webhook"|"email")=><div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>{kind==="webhook"?"Event / pembelian":"Jenis / penerima"}</th><th>Status</th><th>Waktu</th><th>Detail</th><th>Tindakan</th></tr></thead>
    <tbody>{rows?.map(row=><tr key={row.id}>
      <td><strong>{kind==="webhook"?row.purchase_id||row.event_id:emailKind(row.kind||"")}</strong><small>{kind==="webhook"?row.source:row.recipient}</small></td>
      <td><span className={`${styles.status} ${row.status==="failed"?styles.danger:row.status==="sent"||row.status==="processed"?styles.good:styles.wait}`}>{jobStatus(row)}</span></td>
      <td>{date(row.created_at)} WITA</td><td>{row.last_error||jobStage(row.stage)||`${row.attempts} percobaan`}</td>
      <td>{row.status==="failed"?<button className="button secondary" disabled={busy} onClick={()=>void act("retry",row.id,kind)}>Proses ulang</button>:"—"}</td>
    </tr>)}{!rows?.length&&<tr><td colSpan={5} className={styles.empty}>{loading?"Memuat job...":"Belum ada job."}</td></tr>}</tbody>
  </table></div>;

  return <>
    <PageTop eyebrow={area==="access"?"ADMIN / PENGGUNA":"ADMIN / OPERASIONAL"} title={area==="access"?"Pengguna & akses":"Integrasi & email"}
      description={area==="access"?"Satu pembelian dapat memberi beberapa hak fitur. Tindakan akses tercatat dalam audit.":"Pantau webhook pembelian, antrean email, dan kesehatan worker."}
      actions={<button className="button secondary" disabled={loading} onClick={()=>void load()}><RefreshCw size={15}/>{loading?"Memuat...":"Perbarui data"}</button>}/>
    {notice&&<div className="form-message" role="status">{notice}</div>}
    {area==="access"?<>
      {activationLink&&<section className={styles.activationBox} aria-label="Tautan aktivasi cadangan">
        <div className={styles.activationHead}><Link2 size={20}/><div><strong>Tautan aktivasi cadangan siap disalin</strong><small>Untuk {activationLink.email} · Berlaku sampai {date(activationLink.expiresAt)} WITA</small></div><button type="button" onClick={()=>setActivationLink(undefined)} aria-label="Tutup tautan aktivasi"><X size={17}/></button></div>
        <p>Tautan hanya ditampilkan di sini setelah dibuat. Tautan aktivasi sebelumnya tidak berlaku lagi. Bagikan secara pribadi kepada pemilik akun, bukan di grup atau halaman publik.</p>
        <div className={styles.activationActions}><input type="url" aria-label="Tautan aktivasi cadangan" value={activationLink.url} readOnly onFocus={event=>event.target.select()}/><button type="button" className="button primary" onClick={()=>void copyActivationLink()}><Copy size={15}/>Salin tautan</button></div>
      </section>}
      <div className={styles.search}><Search size={18}/><label htmlFor="admin-account-search">Cari pengguna</label><input id="admin-account-search" type="search" value={search} onChange={event=>{setSearch(event.target.value);setActivationLink(undefined);}} placeholder="Masukkan email customer..."/></div>
      <p className={styles.helper}>Menampilkan maksimal 50 akun. Hak Kalkulator HPP dan Galeri Prompt dikelompokkan per pembelian.</p>
      {data?.accounts?.map(user=>{
        const purchases=groupAccessGrants(user.grants);
        return <section className={styles.account} key={user.id}>
          <header className={styles.accountHead}><span className={styles.avatar}>{(user.name||user.email).slice(0,2).toUpperCase()}</span><div><h2>{user.name||user.email}</h2><p>{user.email}</p></div>
            <span className={`${styles.status} ${user.account_status==="active"?styles.good:styles.wait}`}>{accountStatus(user.account_status)}</span>
            {user.account_status==="pending_activation"&&<><button className="button secondary" disabled={busy} onClick={()=>void act("resend_activation",user.id)}>Kirim ulang email</button><button className="button primary" disabled={busy} onClick={()=>void act("generate_activation_link",user.id)}>Buat tautan aktivasi</button></>}
          </header>
          <div className={styles.accountBody}><div className={styles.sectionTitle}><ShieldCheck size={16}/><strong>{purchases.length} pembelian terhubung</strong></div>
            {purchases.length?purchases.map(purchase=><div className={styles.purchase} key={JSON.stringify([purchase.source,purchase.purchaseId])}>
              <div className={styles.purchaseHead}><div><strong>Pembelian {purchase.purchaseId}</strong><small>Sumber: {purchase.source}</small></div><span>{purchase.grants.length} hak fitur</span></div>
              <div className={styles.grantList}>{purchase.grants.map(grant=><div className={styles.grant} key={grant.id}>
                <div><strong>{featureLabel(grant.feature_key)}</strong><small>Produk {grant.product_id}</small></div>
                <span className={`${styles.status} ${grant.status==="active"?styles.good:styles.danger}`}>{grant.status==="active"?"Aktif":"Dicabut"}</span>
                <button className="button secondary" disabled={busy} onClick={()=>void act(grant.status==="active"?"revoke":"restore",grant.id)}>{grant.status==="active"?"Cabut":"Pulihkan"}</button>
              </div>)}</div>
            </div>):<p className={styles.emptyAccount}>Belum ada pembelian atau hak fitur untuk akun ini.</p>}
          </div>
        </section>;
      })}
      {data?.accounts?.length===0&&<div className={styles.emptyPage}>{search?"Tidak ada akun yang cocok.":"Belum ada akun customer."}</div>}
      {!data&&loading&&<div className={styles.emptyPage}>Memuat pengguna...</div>}
    </>:<>
      <div className={styles.workerGrid}>{data?.worker?.length?data.worker.map(worker=>{
        const live=Date.now()-new Date(worker.last_seen).getTime()<60000;
        return <div className={styles.workerCard} key={worker.name}><span className={`${styles.workerIcon} ${live?styles.workerGood:styles.workerWarn}`}><Clock3 size={18}/></span><div><strong>{worker.name}</strong><small>{live?"Aktif":"Periksa worker"} · {date(worker.last_seen)} WITA</small></div></div>;
      }):<div className={styles.workerCard}>Heartbeat worker belum tersedia.</div>}</div>
      <section className={styles.jobPanel}><header><Webhook size={19}/><div><h2>Webhook pembelian</h2><p>Event masuk dari LRMobileID dan hasil pemrosesannya.</p></div><span>{data?.events?.length??0} terbaru</span></header>{jobs(data?.events,"webhook")}</section>
      <section className={styles.jobPanel}><header><Mail size={19}/><div><h2>Antrean email</h2><p>“Diterima SMTP” belum berarti email terlihat di inbox penerima.</p></div><span>{data?.emails?.length??0} terbaru</span></header>{jobs(data?.emails,"email")}</section>
      <p className={styles.helper}>Menampilkan 100 job terbaru. Job gagal dapat dicoba ulang dengan alasan; status review perlu pemeriksaan manual.</p>
    </>}
  </>;
}

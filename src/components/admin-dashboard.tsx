"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookImage, CheckCircle2, CircleAlert, Clock3, MailWarning, RefreshCw, ShoppingBag, UsersRound, Webhook } from "lucide-react";
import { api } from "@/lib/api";
import { PageTop } from "./shell";
import styles from "./admin-dashboard.module.css";

type Dashboard = {
  metrics: { total_users:number; active_users:number; pending_users:number; users_with_access:number;
    linked_purchases:number; active_prompt_cards:number; failed_webhooks:number; failed_emails:number;failed_meta_events:number };
  recentAccounts: { email:string; name:string; account_status:string; created_at:string }[];
  recentEvents: { event_id:string; source:string; purchase_id:string; status:string; stage:string; created_at:string }[];
  worker: { name:string; last_seen:string }[];
  sales:{completed:number;pending:number;failed:number;revenue:string};
  trend:{day:string;revenue:string;orders:number}[];
  updatedAt:string;
};

const date = (value:string) => new Date(value).toLocaleString("id-ID",{timeZone:"Asia/Makassar",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const accountLabel = (status:string) => status==="active"?"Aktif":status==="pending_activation"?"Menunggu aktivasi":status==="suspended"?"Ditangguhkan":status;
const eventLabel = (status:string,stage:string) => status==="processed"?"Selesai":status==="failed"?"Gagal":status==="review_required"?"Perlu ditinjau":status==="ignored"||stage==="ignored_product"?"Diabaikan":status==="pending"?"Menunggu":status;

export function AdminDashboard(){
  const [data,setData]=useState<Dashboard>();
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try { setData(await api<Dashboard>("/api/admin/dashboard")); }
    catch(cause){setError(cause instanceof Error?cause.message:"Dashboard gagal dimuat.");}
    finally {setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const metrics=data?.metrics;
  const failures=(metrics?.failed_webhooks??0)+(metrics?.failed_emails??0)+(metrics?.failed_meta_events??0);
  const attentionHref=(metrics?.failed_meta_events??0)>0&&(metrics?.failed_webhooks??0)+(metrics?.failed_emails??0)===0?"/admin/meta":"/admin/integrations";
  const cards=[
    {label:"Total pengguna",value:metrics?.total_users,detail:"Akun customer terdaftar",href:"/admin/access",icon:UsersRound},
    {label:"Pengguna berakses",value:metrics?.users_with_access,detail:"Akun aktif dengan hak fitur",href:"/admin/access",icon:CheckCircle2},
    {label:"Menunggu aktivasi",value:metrics?.pending_users,detail:"Perlu menyelesaikan email aktivasi",href:"/admin/access",icon:Clock3},
    {label:"Pembelian LRMobileID",value:metrics?.linked_purchases,detail:"Transaksi webhook unik, bukan jumlah fitur",href:"/admin/integrations",icon:ShoppingBag},
    {label:"Kartu prompt aktif",value:metrics?.active_prompt_cards,detail:"Tampil di galeri customer",href:"/admin/prompts",icon:BookImage},
    {label:"Job perlu perhatian",value:metrics?failures:undefined,detail:"Webhook, email, dan Meta CAPI gagal",href:attentionHref,icon:CircleAlert},
  ];
  const latestWorker=data?.worker.reduce<string|undefined>((latest,row)=>!latest||row.last_seen>latest?row.last_seen:latest,undefined);
  const maxSales=Math.max(1,...(data?.trend.map(row=>Number(row.revenue))||[]));

  return <>
    <PageTop eyebrow="RINGKASAN ADMIN" title="Dashboard KulinerKit" description="Pantau pengguna, akses, konten, dan proses otomatis dari satu tempat."
      actions={<button className="button secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{loading?"Memuat...":"Perbarui data"}</button>}/>
    {error&&<div className="form-message error" role="alert">{error} <button className="button secondary" onClick={()=>void load()}>Coba lagi</button></div>}
    <section className={styles.hero} aria-label="Status operasional">
      <div><span>RINGKASAN OPERASIONAL</span><h2>{!metrics?"Memuat status operasional...":failures?`${failures} job perlu ditangani`:"Semua job tanpa kegagalan"}</h2><p>Angka pembelian dihitung per transaksi. Satu pembelian bundle dapat menghasilkan dua hak fitur tanpa menjadi dua transaksi.</p></div>
      <Link href={failures?attentionHref:"/admin/access"}>{failures?"Periksa integrasi":"Lihat pengguna"}<ArrowRight size={17}/></Link>
    </section>
    <section className={styles.sales} aria-label="Penjualan checkout langsung"><div className={styles.salesHead}><div><span>PENJUALAN LANGSUNG</span><h2>Checkout KulinerKit</h2><p>Hanya pesanan di aplikasi ini; pembelian via LRMobileID tidak digabung.</p></div><Link href="/admin/transactions">Kelola transaksi <ArrowRight size={16}/></Link></div><div className={styles.salesStats}><div><span>Omzet terverifikasi</span><strong>Rp{Number(data?.sales.revenue||0).toLocaleString("id-ID")}</strong></div><div><span>Complete</span><strong>{data?.sales.completed??"—"}</strong></div><div><span>Pending</span><strong>{data?.sales.pending??"—"}</strong></div><div><span>Failed</span><strong>{data?.sales.failed??"—"}</strong></div></div><div className={styles.chartHead}><strong>Penjualan 30 hari terakhir</strong><small>Berdasarkan tanggal status complete</small></div><div className={styles.chart} role="img" aria-label="Grafik omzet checkout langsung 30 hari terakhir">{data?.trend.map(row=><div key={row.day} title={`${row.day}: Rp${Number(row.revenue).toLocaleString("id-ID")} (${row.orders} pesanan)`}><span style={{height:`${Math.max(2,Number(row.revenue)/maxSales*100)}%`}}/></div>)}</div><div className={styles.chartLabels}><span>30 hari lalu</span><span>Hari ini</span></div></section>
    <section className={styles.metrics} aria-label="Metrik utama">
      {cards.map(({label,value,detail,href,icon:Icon})=><Link key={label} href={href} className={styles.metric}>
        <span className={styles.metricIcon}><Icon size={20}/></span><span className={styles.metricLabel}>{label}</span>
        <strong>{value===undefined?"—":value.toLocaleString("id-ID")}</strong><small>{detail}</small>
      </Link>)}
    </section>
    <div className={styles.lower}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>AKUN TERBARU</span><h2>Pengguna baru</h2></div><Link href="/admin/access">Lihat semua <ArrowRight size={15}/></Link></div>
        {data?.recentAccounts.length?data.recentAccounts.map(account=><div className={styles.listRow} key={account.email}>
          <span className={styles.initial}>{(account.name||account.email).slice(0,1).toUpperCase()}</span><div><strong>{account.name||account.email}</strong><small>{account.email}</small></div>
          <span className={`${styles.pill} ${account.account_status==="active"?styles.good:styles.wait}`}>{accountLabel(account.account_status)}</span>
          <time dateTime={account.created_at}>{date(account.created_at)}</time>
        </div>):<div className={styles.empty}>{loading?"Memuat pengguna...":"Belum ada akun customer."}</div>}
      </section>
      <div className={styles.sideColumn}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span>AKTIVITAS</span><h2>Webhook terbaru</h2></div><Link href="/admin/integrations">Detail <ArrowRight size={15}/></Link></div>
          {data?.recentEvents.length?data.recentEvents.map(event=><div className={styles.eventRow} key={event.event_id}>
            <span className={styles.eventIcon}><Webhook size={17}/></span><div><strong>{event.purchase_id||event.event_id}</strong><small>{date(event.created_at)} · {event.source}</small></div>
            <span className={`${styles.pill} ${event.status==="processed"?styles.good:event.status==="failed"?styles.bad:styles.wait}`}>{eventLabel(event.status,event.stage)}</span>
          </div>):<div className={styles.empty}>{loading?"Memuat aktivitas...":"Belum ada webhook masuk."}</div>}
        </section>
        <section className={styles.health}><span className={styles.healthIcon}><MailWarning size={19}/></span><div><strong>Email gagal: {metrics?.failed_emails??"—"} · Webhook gagal: {metrics?.failed_webhooks??"—"} · <Link href="/admin/meta">Meta gagal: {metrics?.failed_meta_events??"—"}</Link></strong><small>{latestWorker?`Heartbeat worker terakhir ${date(latestWorker)} WITA`:"Heartbeat worker belum tersedia"}</small></div></section>
      </div>
    </div>
    {data&&<p className={styles.updated}>Diperbarui {date(data.updatedAt)} WITA · Akun aktif: {metrics?.active_users??0}</p>}
  </>;
}

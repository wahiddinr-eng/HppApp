"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import styles from "./landing.module.css";
import { MetaPageEvent } from "./meta-page-event";
const money=(n:number)=>"Rp"+n.toLocaleString("id-ID");
export function LandingOffer(){
  const [offer,setOffer]=useState<{price:number;comparePrice:number;enabled:boolean;promo:{enabled:boolean;name:string;limit:number;remaining:number;deadline:string|null;active:boolean;expired:boolean}|null}>({price:125000,comparePrice:299000,enabled:true,promo:null});
  const [loaded,setLoaded]=useState(false);
  const [now,setNow]=useState(0);
  useEffect(()=>{const refresh=()=>void api<typeof offer>("/api/checkout").then(value=>{setOffer(value);setLoaded(true);}).catch(()=>undefined);refresh();const poll=window.setInterval(refresh,30000);return()=>window.clearInterval(poll);},[]);
  useEffect(()=>{if(!offer.promo?.deadline)return;const tick=()=>setNow(Date.now());tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);},[offer.promo?.deadline]);
  const promo=offer.promo;
  const remainingMs=promo?.deadline&&now?Math.max(0,new Date(promo.deadline).getTime()-now):null;
  const days=remainingMs===null?0:Math.floor(remainingMs/86400000);
  const hours=remainingMs===null?0:Math.floor(remainingMs/3600000)%24;
  const minutes=remainingMs===null?0:Math.floor(remainingMs/60000)%60;
  const seconds=remainingMs===null?0:Math.floor(remainingMs/1000)%60;
  const ended=Boolean(promo?.enabled&&(!promo.active||remainingMs===0));
  return <>{loaded&&<MetaPageEvent name="ViewContent" price={offer.price}/>}<div className={styles.offerPrice}><del>{money(offer.comparePrice)}</del><strong>{money(offer.price)}</strong><span>sekali bayar · seluruh fitur</span></div>
    {loaded&&promo?.enabled&&<div className={styles.promoCountdown} aria-live="off"><div className={styles.promoCountdownTop}><span>{promo.name||"Promo terbatas"}</span><strong>{ended?"Kuota atau waktu promo habis":`${promo.remaining} dari ${promo.limit} kuota tersedia`}</strong></div><div className={styles.promoTrack} aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,promo.remaining/promo.limit*100))}%`}}/></div>{remainingMs!==null&&<p>{remainingMs>0?`Berakhir dalam ${days?`${days} hari `:""}${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`:"Waktu promo telah berakhir"}</p>}<small>Kuota dihitung dari pesanan promo yang masih menunggu pembayaran dan yang sudah terverifikasi.</small></div>}
    {ended?<p className={styles.promoEnded}>Penawaran ini sudah selesai. Hubungi tim KulinerKit untuk informasi harga terbaru.</p>:!offer.enabled&&loaded?<p className={styles.promoEnded}>Pembelian sedang ditutup sementara. Silakan hubungi tim KulinerKit.</p>:<Link href="/checkout" className={styles.primaryButton}>Beli akses KulinerKit <ArrowUpRight size={18}/></Link>}</>;
}

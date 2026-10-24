"use client";
import { useEffect,useState,type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft,ArrowRight,CheckCircle2,LockKeyhole,ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import styles from "./checkout.module.css";
import { MetaPageEvent } from "./meta-page-event";
import { CheckoutBrand } from "./checkout-brand";
type Settings={price:number;comparePrice:number;enabled:boolean;methods:{qris:boolean;bank:boolean};promo:{enabled:boolean;remaining:number;limit:number;active:boolean;expired:boolean}|null};
const money=(n:number)=>"Rp"+n.toLocaleString("id-ID");
export function CheckoutPage(){
  const [settings,setSettings]=useState<Settings>();const [error,setError]=useState("");const [submitting,setSubmitting]=useState(false);
  const [name,setName]=useState("");const [email,setEmail]=useState("");const [phone,setPhone]=useState("");const [method,setMethod]=useState<"qris"|"bank">("qris");const [website,setWebsite]=useState("");
  useEffect(()=>{void api<Settings>("/api/checkout").then(value=>{setSettings(value);setMethod(value.methods.qris?"qris":"bank");}).catch(cause=>setError(cause instanceof Error?cause.message:"Checkout gagal dimuat."));},[]);
  async function submit(event:FormEvent){event.preventDefault();setSubmitting(true);setError("");try{
    const result=await api<{url:string}>("/api/checkout/orders",{method:"POST",body:JSON.stringify({name,email,phone,method,website})});
    window.location.assign(result.url);
  }catch(cause){setError(cause instanceof Error?cause.message:"Pesanan gagal dibuat.");setSubmitting(false);}}
  const available=settings?.enabled&&(settings.methods.qris||settings.methods.bank);
  return <div className={styles.page}>{available&&settings&&<MetaPageEvent name="InitiateCheckout" price={settings.price}/>}<header className={styles.header}><CheckoutBrand/><Link href="/" className={styles.back}><ArrowLeft size={16}/> Kembali ke beranda</Link></header>
    <main className={styles.main}><div className={styles.intro}><span className={styles.eyebrow}>LANGKAH PERTAMA USAHA LEBIH TERARAH</span><h1>Mulai bersama <em>KulinerKit.</em></h1><p>Satu toolkit untuk menyiapkan harga, promosi, target, dan evaluasi usaha kuliner Anda.</p></div>
      <div className={styles.grid}><section className={styles.card}><div className={styles.sectionHead}><span>01</span><div><h2>Data pembelian</h2><p>Instruksi pembayaran dan akses dikirim ke email ini.</p></div></div>
        {error&&<p className={styles.error} role="alert">{error}</p>}
        <form onSubmit={submit}><label>Nama lengkap<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={100} autoComplete="name" required placeholder="Nama Anda"/></label><label>Email aktif<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete="email" required placeholder="nama@email.com"/></label><label>Nomor WhatsApp aktif<input type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} minLength={10} maxLength={30} autoComplete="tel" required placeholder="Contoh: 081234567890"/><span className={styles.fieldHint}>Dipakai untuk konfirmasi pesanan jika diperlukan.</span></label><div className={styles.honeypot} aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
          <fieldset><legend>Pilih pembayaran</legend><div className={styles.methods}><label className={method==="qris"?styles.selected:""}><input type="radio" name="method" value="qris" checked={method==="qris"} onChange={()=>setMethod("qris")} disabled={!settings?.methods.qris}/>QRIS <small>Scan dengan aplikasi pembayaran</small></label><label className={method==="bank"?styles.selected:""}><input type="radio" name="method" value="bank" checked={method==="bank"} onChange={()=>setMethod("bank")} disabled={!settings?.methods.bank}/>Transfer bank <small>Bayar lewat rekening bank</small></label></div></fieldset>
          <button className={styles.button} type="submit" disabled={!available||submitting}>{submitting?"Membuat pesanan...":available?"Lanjut ke pembayaran":settings?.promo?.enabled&&!settings.promo.active?"Promo telah berakhir":"Pembayaran belum tersedia"}<ArrowRight size={18}/></button><p className={styles.fine}><LockKeyhole size={14}/> Anda akan menerima halaman pembayaran dan salinannya melalui email.</p></form>
      </section><aside className={styles.summary}><span className={styles.eyebrow}>RINGKASAN PESANAN</span><h2>Semua fitur, satu akses.</h2><div className={styles.price}><del>{money(settings?.comparePrice??299000)}</del><strong>{money(settings?.price??125000)}</strong><small>Sekali bayar</small>{settings?.promo?.enabled&&<span className={styles.promoNote}>{settings.promo.active?`${settings.promo.remaining} dari ${settings.promo.limit} kuota promo masih tersedia`:"Kuota atau waktu promo berakhir"}</span>}</div><ul>{["Kalkulator HPP & harga jual", "Galeri Prompt untuk promosi", "Target untung dan titik impas", "Rekap serta analisis penjualan", "Panduan penggunaan"].map(item=><li key={item}><CheckCircle2 size={17}/>{item}</li>)}</ul><p><ShieldCheck size={18}/> Akses dikirim setelah pembayaran diverifikasi admin. Anda tidak perlu langsung membuat password di sini.</p></aside></div>
    </main></div>;
}

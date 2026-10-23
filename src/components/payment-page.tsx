"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import Link from "next/link";
import { ArrowLeft,Check,Copy,MessageCircle,RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { rememberClickId, trackPurchasePixel } from "./meta-page-event";
import styles from "./checkout.module.css";
import { CheckoutBrand } from "./checkout-brand";
type Order={code:string;customer_name:string;customer_email:string;customer_phone:string|null;payment_method:"qris"|"bank";price:number;compare_price:number;status:"pending"|"failed"|"complete";payment_snapshot:{bankName?:string;accountNumber?:string;accountHolder?:string};created_at:string;metaPurchase:{eventId:string;pixelId:string}|null};
const money=(n:number)=>"Rp"+n.toLocaleString("id-ID");
export function PaymentPage({token}:{token:string}){
  const [order,setOrder]=useState<Order>();const [error,setError]=useState("");const [copied,setCopied]=useState(false);
  const [checking,setChecking]=useState(false);const [checkNotice,setCheckNotice]=useState("");
  const tracked=useRef(new Set<string>());
  const load=useCallback(async(manual=false)=>{if(manual)setChecking(true);try{
    const latest=await api<Order>(`/api/checkout/orders/${token}`);
    if(latest.status==="complete"){
      rememberClickId();
      // The token is a bearer secret: remove it before loading Meta's browser script.
      if(window.location.pathname!=="/pay/verified")window.history.replaceState(null,"","/pay/verified");
      const purchase=latest.metaPurchase;
      if(purchase){
        const key=`kulinerkit:purchase:${purchase.pixelId}:${purchase.eventId}`;
        let seen=tracked.current.has(key);
        try{seen=seen||localStorage.getItem(key)==="sent";}catch{ /* Storage may be unavailable. */ }
        if(!seen&&trackPurchasePixel(purchase.pixelId,purchase.eventId,latest.price,latest.code)){
          tracked.current.add(key);
          try{localStorage.setItem(key,"sent");}catch{ /* The in-memory guard still prevents repeat clicks. */ }
        }
      }
    }
    setOrder(latest);setError("");
    if(manual)setCheckNotice(latest.status==="complete"?"Pembayaran sudah terverifikasi. Periksa email untuk langkah akses berikutnya.":latest.status==="failed"?"Pesanan perlu bantuan. Hubungi tim KulinerKit jika Anda sudah membayar.":"Pembayaran belum terverifikasi. Jika sudah membayar, kirim bukti melalui WhatsApp lalu cek kembali nanti.");
  }catch(cause){setError(cause instanceof Error?cause.message:"Pesanan tidak dapat dimuat.");}finally{if(manual)setChecking(false);}},[token]);
  useEffect(()=>{void load();},[load]);
  const message=order?`Halo tim KulinerKit, saya ingin konfirmasi pembayaran pesanan ${order.code}.\nNama: ${order.customer_name}\nEmail: ${order.customer_email}${order.customer_phone?`\nNomor WhatsApp: ${order.customer_phone}`:""}\nMetode: ${order.payment_method==="qris"?"QRIS":"Transfer bank"}\nNominal: ${money(order.price)}\nSaya akan mengirim bukti pembayaran melalui chat ini. Mohon bantu verifikasi, terima kasih.`:"";
  const whatsapp=`https://wa.me/6285161218257?text=${encodeURIComponent(message)}`;
  async function copy(value:string){await navigator.clipboard.writeText(value);setCopied(true);window.setTimeout(()=>setCopied(false),2500);}
  return <div className={styles.page}><header className={styles.header}><CheckoutBrand/><Link href="/" className={styles.back}><ArrowLeft size={16}/> Beranda</Link></header><main className={styles.paymentMain}>
    <div className={styles.intro}><span className={styles.eyebrow}>PEMBAYARAN KULINERKIT</span><h1>{order?.status==="complete"?"Pembayaran terverifikasi.":order?.status==="failed"?"Pesanan perlu bantuan.":"Selesaikan pembayaran."}</h1><p>Kode pesanan <strong>{order?.code||"—"}</strong> · Simpan email pembayaran untuk membuka kembali tautan pesanan.</p></div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {order&&<div className={styles.grid}><section className={styles.card}><div className={styles.status} data-status={order.status}>{order.status==="complete"?"Pembayaran terverifikasi":order.status==="failed"?"Pesanan gagal / dibatalkan":"Menunggu verifikasi pembayaran"}</div><div className={styles.total}><span>Total pembayaran</span><strong>{money(order.price)}</strong></div>
      {order.status==="pending"&&<>{order.payment_method==="qris"?<div className={styles.qris}><h2>Scan QRIS berikut</h2><p>Gunakan aplikasi pembayaran Anda, lalu pastikan nominalnya sama persis.</p>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/checkout/orders/${token}/qris`} alt="QRIS pembayaran KulinerKit"/></div>:<div className={styles.bank}><h2>Transfer ke rekening ini</h2><div><span>Bank</span><strong>{order.payment_snapshot.bankName}</strong></div><div><span>Nomor rekening</span><strong>{order.payment_snapshot.accountNumber}</strong><button onClick={()=>void copy(order.payment_snapshot.accountNumber||"")} aria-label="Salin nomor rekening"><Copy size={16}/></button></div><div><span>Atas nama</span><strong>{order.payment_snapshot.accountHolder}</strong></div></div>}
      <div className={styles.confirm}><h2>Sudah membayar?</h2><p>Konfirmasikan lewat WhatsApp dan lampirkan bukti pembayaran di chat. Admin akan memeriksa dana masuk sebelum mengaktifkan akses.</p><a className={styles.button} href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/> Konfirmasi via WhatsApp</a><span className={styles.templateLabel}>Template pesan konfirmasi</span><pre>{message}</pre><button className={styles.copyButton} onClick={()=>void copy(message)}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?"Tersalin":"Salin pesan"}</button></div></>}
      {order.status==="complete"&&<p className={styles.success}>Pembayaran sudah terverifikasi. Jika ini akun baru, buka tautan aktivasi di email <strong>{order.customer_email}</strong> untuk membuat password. Jika Anda sudah punya akun, gunakan password lama untuk masuk. Cek juga folder Spam/Promosi.</p>}
      {order.status==="failed"&&<p className={styles.error}>Jika Anda sudah membayar, hubungi bantuan dan sertakan kode pesanan {order.code}.</p>}
    </section><aside className={styles.summary}><span className={styles.eyebrow}>DETAIL PESANAN</span><h2>Akses KulinerKit</h2><div className={styles.detail}><span>Nama</span><strong>{order.customer_name}</strong></div><div className={styles.detail}><span>Email</span><strong>{order.customer_email}</strong></div><div className={styles.detail}><span>Nomor WhatsApp</span><strong>{order.customer_phone||"—"}</strong></div><div className={styles.detail}><span>Metode</span><strong>{order.payment_method==="qris"?"QRIS statis":"Transfer bank"}</strong></div><div className={styles.detail}><span>Tanggal</span><strong>{new Date(order.created_at).toLocaleString("id-ID")}</strong></div><button className={styles.refresh} onClick={()=>void load(true)} disabled={checking}><RefreshCw size={16}/> {checking?"Memeriksa status...":"Sudah bayar? Perbarui status"}</button><p>Tombol ini hanya mengecek hasil verifikasi admin, bukan mengonfirmasi pembayaran otomatis. Setelah mengirim bukti via WhatsApp, periksa kembali di sini.</p>{checkNotice&&<p className={order.status==="complete"?styles.success:styles.checkNotice} role="status">{checkNotice}</p>}</aside></div>}
  </main></div>;
}

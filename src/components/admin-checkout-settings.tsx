"use client";
import { useCallback,useEffect,useState,type FormEvent } from "react";
import { ImageUp,Save,ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { PageTop } from "./shell";
import styles from "./admin-checkout.module.css";
type Settings={price:number;compare_price:number;enabled:boolean;bank_name:string;account_number:string;account_holder:string;qris_image_key:string|null;updated_at:string};
export function AdminCheckoutSettings(){
  const [settings,setSettings]=useState<Settings>();const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const [image,setImage]=useState<File>();const [imageVersion,setImageVersion]=useState(0);
  const load=useCallback(async()=>{try{setSettings(await api<Settings>("/api/admin/checkout"));setError("");}catch(cause){setError(cause instanceof Error?cause.message:"Pengaturan gagal dimuat.");}},[]);
  useEffect(()=>{void load();},[load]);
  function change<K extends keyof Settings>(key:K,value:Settings[K]){setSettings(old=>old?{...old,[key]:value}:old);}
  async function save(event:FormEvent){event.preventDefault();if(!settings)return;setBusy(true);setError("");setNotice("");try{
    await api("/api/admin/checkout",{method:"PUT",body:JSON.stringify({price:settings.price,comparePrice:settings.compare_price,enabled:settings.enabled,bankName:settings.bank_name,accountNumber:settings.account_number,accountHolder:settings.account_holder})});
    setNotice("Pengaturan checkout tersimpan.");await load();
  }catch(cause){setError(cause instanceof Error?cause.message:"Gagal menyimpan.");}finally{setBusy(false);}}
  async function upload(){if(!image)return;setBusy(true);setError("");setNotice("");try{
    const form=new FormData();form.set("image",image);
    const response=await fetch("/api/admin/checkout/qris",{method:"POST",body:form,credentials:"same-origin"});
    const data=await response.json();if(!response.ok)throw new Error(data.message||"Gagal mengunggah QRIS.");
    setNotice("Gambar QRIS tersimpan.");setImage(undefined);setImageVersion(value=>value+1);await load();
  }catch(cause){setError(cause instanceof Error?cause.message:"Gagal mengunggah QRIS.");}finally{setBusy(false);}}
  return <><PageTop eyebrow="PENJUALAN LANGSUNG" title="Pengaturan checkout" description="Atur harga dan instruksi pembayaran. Checkout tetap tertutup sampai Anda mengaktifkannya."/>
    {error&&<p className="form-message error" role="alert">{error}</p>}{notice&&<p className="form-message" role="status">{notice}</p>}
    <div className={styles.grid}><form className={styles.panel} onSubmit={save}><div className={styles.panelHead}><span>01 / PENAWARAN</span><h2>Harga & ketersediaan</h2></div>
      <div className={styles.fields}><label>Harga jual (Rp)<input type="number" min="1000" max="100000000" value={settings?.price??125000} onChange={e=>change("price",Number(e.target.value))} required/></label><label>Harga coret (Rp)<input type="number" min="1001" max="100000000" value={settings?.compare_price??299000} onChange={e=>change("compare_price",Number(e.target.value))} required/></label></div>
      <p className={styles.note}>Harga saat pesanan dibuat disimpan sebagai snapshot. Perubahan harga berikutnya tidak mengubah pesanan lama.</p><label className={styles.switch}><input type="checkbox" checked={settings?.enabled??false} onChange={e=>change("enabled",e.target.checked)}/><span><strong>Buka checkout langsung</strong><small>Aktifkan setelah QRIS atau rekening valid dan email Brevo siap.</small></span></label>
      <div className={styles.panelHead}><span>02 / TRANSFER BANK</span><h2>Rekening tujuan</h2></div><div className={styles.fields}><label>Nama bank<input value={settings?.bank_name??""} onChange={e=>change("bank_name",e.target.value)} maxLength={100} placeholder="Contoh: BCA"/></label><label>Nomor rekening<input value={settings?.account_number??""} onChange={e=>change("account_number",e.target.value)} maxLength={60} placeholder="Nomor rekening"/></label><label className={styles.full}>Atas nama<input value={settings?.account_holder??""} onChange={e=>change("account_holder",e.target.value)} maxLength={100} placeholder="Nama pemilik rekening"/></label></div><button className="button" type="submit" disabled={!settings||busy}><Save size={17}/> {busy?"Memproses...":"Simpan pengaturan"}</button></form>
    <section className={styles.panel}><div className={styles.panelHead}><span>03 / QRIS STATIS</span><h2>Gambar QRIS</h2></div><p className={styles.note}>Unggah QRIS JPG, PNG, atau WebP (maks. 8 MB). Nominal QRIS statis harus diisi pelanggan sesuai total pesanan.</p>{settings?.qris_image_key?<div className={styles.preview}><span>QRIS yang aktif</span>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/admin/checkout/qris/image?v=${imageVersion}`} alt="QRIS KulinerKit yang aktif"/></div>:<div className={styles.empty}>Belum ada QRIS. Anda tetap bisa menggunakan transfer bank.</div>}<label className={styles.upload}><ImageUp size={18}/> Pilih gambar QRIS<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImage(e.target.files?.[0])}/></label>{image&&<p className={styles.selected}>{image.name}</p>}<button className="button secondary" type="button" onClick={()=>void upload()} disabled={!image||busy}>Unggah QRIS</button><div className={styles.warning}><ShieldCheck size={18}/><p>Pastikan dana benar-benar masuk sebelum menandai transaksi complete. WhatsApp hanya sarana konfirmasi pelanggan, bukan bukti pembayaran otomatis.</p></div></section></div>
  </>;
}

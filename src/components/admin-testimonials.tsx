"use client";
import { useCallback,useEffect,useState,type FormEvent } from "react";
import { Pencil,Plus,Save,Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageTop } from "./shell";
import styles from "./admin-testimonials.module.css";

type Row={id:string;customer_name:string;business_name:string;quote:string;consent_confirmed:boolean;published:boolean;sort_order:number};
type Draft={id?:string;customerName:string;businessName:string;quote:string;consentConfirmed:boolean;published:boolean;sortOrder:number};
const blank:Draft={customerName:"",businessName:"",quote:"",consentConfirmed:false,published:false,sortOrder:0};
function fromRow(row:Row):Draft{return {id:row.id,customerName:row.customer_name,businessName:row.business_name,quote:row.quote,consentConfirmed:row.consent_confirmed,published:row.published,sortOrder:row.sort_order};}

export function AdminTestimonials(){
  const [items,setItems]=useState<Row[]>([]);const [draft,setDraft]=useState<Draft>(blank);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const load=useCallback(async()=>{try{setItems(await api<Row[]>("/api/admin/testimonials"));setError("");}catch(cause){setError(cause instanceof Error?cause.message:"Testimoni gagal dimuat.");}},[]);
  useEffect(()=>{void load();},[load]);
  function change<K extends keyof Draft>(key:K,value:Draft[K]){setDraft(old=>({...old,[key]:value}));}
  async function save(event:FormEvent){event.preventDefault();setBusy(true);setError("");setNotice("");try{
    await api("/api/admin/testimonials",{method:draft.id?"PUT":"POST",body:JSON.stringify(draft)});
    setNotice(draft.published?"Testimoni tersimpan dan tampil di landing page.":"Draft testimoni tersimpan.");setDraft(blank);await load();
  }catch(cause){setError(cause instanceof Error?cause.message:"Testimoni gagal disimpan.");}finally{setBusy(false);}}
  async function remove(row:Row){if(!window.confirm(`Hapus testimoni ${row.customer_name}?`))return;setBusy(true);setError("");try{await api(`/api/admin/testimonials?id=${encodeURIComponent(row.id)}`,{method:"DELETE"});if(draft.id===row.id)setDraft(blank);setNotice("Testimoni dihapus.");await load();}catch(cause){setError(cause instanceof Error?cause.message:"Gagal menghapus testimoni.");}finally{setBusy(false);}}
  return <><PageTop eyebrow="KONTEN LANDING PAGE" title="Testimoni pelanggan" description="Tulis pengalaman pelanggan yang benar-benar ada. Hanya testimoni berizin dan diterbitkan yang tampil di halaman publik."/>
    {error&&<p className="form-message error" role="alert">{error}</p>}{notice&&<p className="form-message" role="status">{notice}</p>}
    <div className={styles.layout}><form className={styles.editor} onSubmit={save}><div className={styles.editorHead}><div><span>{draft.id?"EDIT TESTIMONI":"TAMBAH TESTIMONI"}</span><h2>{draft.id?"Perbarui cerita pelanggan":"Cerita baru"}</h2></div>{draft.id&&<button type="button" className={styles.textButton} onClick={()=>setDraft(blank)}><Plus size={15}/> Buat baru</button>}</div>
      <label>Nama pelanggan<input value={draft.customerName} onChange={e=>change("customerName",e.target.value)} minLength={2} maxLength={100} required placeholder="Nama sesuai izin pelanggan"/></label>
      <label>Nama usaha / keterangan (opsional)<input value={draft.businessName} onChange={e=>change("businessName",e.target.value)} maxLength={120} placeholder="Contoh: Pemilik dapur rumahan"/></label>
      <label>Isi testimoni<textarea value={draft.quote} onChange={e=>change("quote",e.target.value)} minLength={10} maxLength={1000} rows={6} required placeholder="Tulis kata-kata pelanggan apa adanya."/><small>{draft.quote.length}/1000 karakter</small></label>
      <label>Urutan tampil<input type="number" min="0" max="100000" value={draft.sortOrder} onChange={e=>change("sortOrder",Number(e.target.value))} required/><small>Angka lebih kecil tampil lebih dahulu. Maksimal 12 testimoni tayang.</small></label>
      <label className={styles.check}><input type="checkbox" checked={draft.consentConfirmed} onChange={e=>change("consentConfirmed",e.target.checked)}/><span>Saya memiliki izin pelanggan untuk menampilkan nama dan isi testimoni ini di landing page.</span></label>
      <label className={styles.check}><input type="checkbox" checked={draft.published} onChange={e=>change("published",e.target.checked)}/><span>Terbitkan di landing page sekarang</span></label>
      <button className="button" type="submit" disabled={busy||draft.published&&!draft.consentConfirmed}><Save size={17}/>{busy?"Menyimpan...":"Simpan testimoni"}</button></form>
      <section className={styles.list}><div className={styles.listHead}><div><span>KONTEN TERSIMPAN</span><h2>{items.length} testimoni</h2></div></div>{items.length?items.map(row=><article key={row.id} className={styles.item}><div className={styles.itemMeta}><strong>{row.customer_name}</strong><span className={row.published?styles.published:styles.draft}>{row.published?"Tayang":"Draft"}</span></div>{row.business_name&&<small>{row.business_name}</small>}<blockquote>“{row.quote}”</blockquote><div className={styles.itemFoot}><span>Urutan {row.sort_order}</span><div><button type="button" onClick={()=>{setDraft(fromRow(row));window.scrollTo({top:0,behavior:"smooth"});}}><Pencil size={15}/> Edit</button><button type="button" onClick={()=>void remove(row)} disabled={busy}><Trash2 size={15}/> Hapus</button></div></div></article>):<div className={styles.empty}>Belum ada testimoni. Landing page tidak menampilkan bagian ini sampai Anda menerbitkan testimoni asli.</div>}</section></div>
  </>;
}

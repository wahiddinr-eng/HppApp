"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleAlert, CircleCheck, ClipboardList, FlaskConical, Info, Layers3, Plus, ReceiptText, Save, Sparkles, Trash2, Users, Wallet } from "lucide-react";
import { blankCalculation, calculate, Calculation, convertUnit, CostStatus, moneyInput, outputLabel, parseMoney, parseQuantity, percent, rupiah, subtotalIngredient, subtotalLabor, subtotalOther, subtotalPackage, today, uid, Unit, unitLabel, validate } from "@/lib/hpp";
import { readCalculation, saveCalculation, finalizeRemote } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Shell } from "./shell";

type Errors = Record<string, string>;
const statusNames: Record<CostStatus, string> = { pending: "Belum dihitung", none: "Tidak ada biaya", filled: "Diisi" };

function Field({ label, value, onChange, onBlur, error, helper, prefix, suffix, id, placeholder, className = "", maxLength }: { label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; error?: string; helper?: string; prefix?: string; suffix?: string; id: string; placeholder?: string; className?: string; maxLength?: number }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span><span className={`input-wrap ${error ? "invalid" : ""}`}>{prefix && <span className="input-affix">{prefix}</span>}<input id={id} data-field={id} value={value} onChange={event => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} maxLength={maxLength} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : helper ? `${id}-help` : undefined} />{suffix && <span className="input-affix suffix">{suffix}</span>}</span>{helper && !error && <small id={`${id}-help`} className="field-help">{helper}</small>}{error && <small id={`${id}-error`} className="field-error">{error}</small>}</label>;
}
function SelectField({ label, value, onChange, options, id, error }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; id: string; error?: string }) {
  return <label className="field"><span className="field-label">{label}</span><span className={`select-wrap ${error ? "invalid" : ""}`}><select id={id} data-field={id} value={value} onChange={event => onChange(event.target.value)} aria-invalid={!!error}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronRight size={17} /></span>{error && <small className="field-error">{error}</small>}</label>;
}
function Section({ index, title, description, icon, children, foot }: { index: string; title: string; description: string; icon: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode }) {
  return <section className="form-section"><div className="section-heading"><div className="section-icon">{icon}</div><div><div className="section-index">{index}</div><h2>{title}</h2><p>{description}</p></div></div><div className="section-body">{children}</div>{foot && <div className="section-foot">{foot}</div>}</section>;
}
function RowTop({ title, index, onRemove }: { title: string; index: number; onRemove: () => void }) { return <div className="cost-row-top"><span>{title} {String(index + 1).padStart(2, "0")}</span><button type="button" className="text-icon danger" onClick={onRemove} aria-label={`Hapus ${title.toLowerCase()} ${index + 1}`}><Trash2 size={16} /> Hapus</button></div>; }
function CategoryStatus({ value, onChange, hasRows }: { value: CostStatus; onChange: (value: CostStatus) => void; hasRows: boolean }) {
  return <div className="category-status"><span>Status kategori</span><div className="status-options">{(["pending", "none", "filled"] as CostStatus[]).map(status => <button type="button" key={status} className={value === status ? "selected" : ""} disabled={hasRows ? status !== "filled" : status === "filled"} onClick={() => onChange(status)}>{statusNames[status]}</button>)}</div></div>;
}

export function Editor({ id }: { id?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Calculation>(() => blankCalculation());
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [message, setMessage] = useState("");
  const [editCounter, setEditCounter] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const conflictRef = useRef(false);
  const counterRef = useRef(0);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const finalizeRef = useRef<{version:number;id:string} | null>(null);
  const dirtyRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;
  useEffect(() => {
    let cancelled=false;
    void (async()=>{
      try {
        const next=id?await readCalculation(id):{...blankCalculation(),business:(await api<{user:{businessName:string|null}}>("/api/profile")).user.businessName||""};
        if(!cancelled){formRef.current=next;setForm(next);setLoaded(true);}
      } catch(error){if(!cancelled)setLoadError(error instanceof Error?error.message:"Gagal memuat draft.");}
    })();
    return()=>{cancelled=true;};
  }, [id]);
  const persist = () => {
    const task=queueRef.current.catch(()=>undefined).then(async()=>{
      if(conflictRef.current)throw new Error("Selesaikan konflik draft terlebih dahulu.");
      if(formRef.current.draftVersion&&!dirtyRef.current)return formRef.current;
      const captured=counterRef.current;
      setSaveState("saving");
      try {
        const saved=await saveCalculation(formRef.current);
        const next={...formRef.current,id:saved.id,draftVersion:saved.draftVersion,revision:saved.revision,updatedAt:saved.updatedAt};
        formRef.current=next;setForm(next);
        dirtyRef.current=captured!==counterRef.current;
        setSaveState(dirtyRef.current?"idle":"saved");
        return next;
      } catch(error){
        setSaveState("failed");
        if(error instanceof ApiError&&error.code==="DRAFT_CONFLICT"){conflictRef.current=true;setConflict(true);}
        throw error;
      }
    });
    queueRef.current=task;return task;
  };
  useEffect(() => {
    if (!loaded || !touched || conflict) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void persist().catch(error=>setMessage(error instanceof Error?error.message:"Gagal menyimpan draft."));
    }, 2000);
    return () => window.clearTimeout(timer);
    // Changes to server metadata must not schedule another save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCounter, loaded, touched, conflict]);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => { if (dirtyRef.current) event.preventDefault(); };
    const navigation=(event:MouseEvent)=>{const link=(event.target as Element).closest?.("a[href]");if(link&&dirtyRef.current&&!window.confirm("Perubahan belum tersimpan. Tetap tinggalkan halaman?")){event.preventDefault();event.stopPropagation();}};
    window.addEventListener("beforeunload", listener);
    document.addEventListener("click",navigation,true);
    return () => {window.removeEventListener("beforeunload", listener);document.removeEventListener("click",navigation,true);};
  }, []);

  const result = useMemo(() => calculate(form), [form]);
  const update = (patch: Partial<Calculation>) => {const next={...formRef.current,...patch,state:"draft" as const};formRef.current=next;setForm(next);dirtyRef.current=true;counterRef.current++;setEditCounter(counterRef.current);setTouched(true);setMessage("");};
  const updateList = <K extends "ingredients" | "packages" | "labor" | "others">(key: K, index: number, patch: Partial<Calculation[K][number]>) => {
    const next = form[key].map((item, position) => position === index ? { ...item, ...patch } : item);
    update({ [key]: next } as Partial<Calculation>);
  };
  const addRow = (key: "ingredients" | "packages" | "labor" | "others") => {
    const max = key === "ingredients" ? 100 : 50;
    if (form[key].length >= max) { setMessage(`Maksimal ${max} baris untuk kategori ini.`); return; }
    const item = key === "ingredients" ? { id: uid(), name: "", quantity: "", unit: "kg", price: "" } : key === "packages" ? { id: uid(), name: "", quantity: "", price: "" } : key === "labor" ? { id: uid(), name: "", people: "1", wage: "" } : { id: uid(), type: "Listrik", note: "", amount: "" };
    const statuses = key === "ingredients" ? form.statuses : { ...form.statuses, [key]: "filled" };
    update({ [key]: [...form[key], item], statuses } as Partial<Calculation>);
  };
  const removeRow = (key: "ingredients" | "packages" | "labor" | "others", index: number) => {
    const next = form[key].filter((_, position) => position !== index);
    const statuses = key === "ingredients" ? form.statuses : { ...form.statuses, [key]: next.length ? "filled" : "pending" };
    update({ [key]: next, statuses } as Partial<Calculation>);
  };
  const changeUnit = (index: number, nextUnit: Unit) => {
    const item = form.ingredients[index];
    if (item.unit === nextUnit) return;
    if ((item.quantity && !item.price) || (!item.quantity && item.price)) { setMessage("Lengkapi jumlah dan harga bahan sebelum mengubah satuan, atau kosongkan keduanya."); return; }
    const converted = convertUnit(item, nextUnit);
    if (converted === undefined) { setMessage("Konversi melebihi 6 desimal. Gunakan satuan sebelumnya atau isi ulang secara manual."); return; }
    if (converted === null) {
      if ((item.quantity || item.price) && !window.confirm("Satuan berbeda jenis. Jumlah dan harga akan dikosongkan agar Anda dapat mengisinya ulang. Lanjutkan?")) return;
      updateList("ingredients", index, { unit: nextUnit, quantity: "", price: "" });
      setMessage("Satuan berubah. Isi ulang jumlah dan harga sesuai satuan baru.");
      return;
    }
    updateList("ingredients", index, converted);
    if (item.quantity && item.price) setMessage(`Jumlah dan harga dikonversi ke ${unitLabel(nextUnit)}; subtotal tetap sama.`);
  };
  const changeTaxMode = (mode: "exclusive" | "inclusive") => {
    if (mode === form.taxMode) return;
    if (form.manualPrice && !window.confirm("Mengubah perlakuan pajak akan mengosongkan harga manual. Lanjutkan?")) return;
    update({ taxMode: mode, manualPrice: "" });
  };
  const saveDraft = async () => {
    setBusy(true);
    try {await persist();setMessage("Draft tersimpan di server.");}
    catch(error){setMessage(error instanceof Error?error.message:"Gagal menyimpan draft.");}
    finally{setBusy(false);}
  };
  const finalize = async () => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Periksa kembali kolom yang ditandai sebelum menyimpan hasil.");
      const first = Object.keys(nextErrors).find(key => key !== "total" && key !== "ingredients" && key !== "packages" && key !== "labor" && key !== "others");
      window.setTimeout(() => { const node = document.querySelector(`[data-field="${first || "name"}"]`) as HTMLElement | null; node?.focus(); node?.scrollIntoView({ block: "center", behavior: "smooth" }); }, 0);
      return;
    }
    setBusy(true);
    try {
      const draft=await persist();
      if(dirtyRef.current)throw new Error("Input berubah saat menyimpan. Coba hitung kembali.");
      if(finalizeRef.current?.version!==draft.draftVersion)finalizeRef.current={version:draft.draftVersion!,id:crypto.randomUUID()};
      const next=await finalizeRemote(draft,finalizeRef.current!.id);
      dirtyRef.current=false;setTouched(false);router.push("/app/calculations/"+next.id+"/report?revision="+next.revision);
    } catch(error){
      setSaveState("failed");setMessage(error instanceof Error?error.message:"Gagal menyimpan hasil.");
      if(error instanceof ApiError){if(error.fieldErrors)setErrors(error.fieldErrors);if(error.code==="DRAFT_CONFLICT"){conflictRef.current=true;setConflict(true);}}
    } finally{setBusy(false);}
  };
  const resolveConflict=async(asNew:boolean)=>{
    setBusy(true);
    try{
      await queueRef.current.catch(()=>undefined);
      const next=asNew?{...formRef.current,id:uid(),draftVersion:undefined,revision:0}:await readCalculation(formRef.current.id);
      formRef.current=next;setForm(next);conflictRef.current=false;setConflict(false);dirtyRef.current=asNew;
      if(asNew){const saved=await persist();router.replace("/app/calculations/"+saved.id+"/edit");}else setSaveState("saved");
      setMessage(asNew?"Salinan baru tersimpan tanpa menimpa draft lainnya.":"Draft terbaru berhasil dimuat.");
    }catch(error){setMessage(error instanceof Error?error.message:"Gagal menyelesaikan konflik.");}
    finally{setBusy(false);}
  };
  if(loadError)return <Shell><p role="alert">{loadError}</p><Link href="/app/calculations">Kembali ke ringkasan</Link></Shell>;
  if(!loaded)return <Shell><p>Memuat draft...</p></Shell>;
  const priceLabel = form.taxEnabled && form.taxMode === "inclusive" ? "Harga jual termasuk pajak" : form.taxEnabled ? "Harga jual sebelum pajak" : "Harga jual pilihan";
  return <Shell><div className="editor-top"><Link className="back-link" href="/app/calculations"><ArrowLeft size={16} /> Kembali ke ringkasan</Link><div className="editor-title"><div><div className="eyebrow">PERHITUNGAN / {id ? "EDIT" : "BARU"}</div><h1>{id ? "Edit perhitungan" : "Perhitungan baru"}</h1><p>Isi biaya untuk satu kali produksi. Ringkasan akan berubah mengikuti angka yang Anda masukkan.</p></div><span className="draft-badge"><span /> {saveState === "saving" ? "Menyimpan..." : saveState === "saved" ? "Tersimpan di server" : saveState === "failed" ? "Gagal menyimpan" : "Draft"}</span></div></div>
    <div className="editor-grid"><div className="editor-main">
      {conflict&&<div className="form-message error" role="alert"><div><p>Draft diubah di tab lain. Pilih cara melanjutkan; input Anda tidak akan ditimpa otomatis.</p><button disabled={busy} className="button secondary" onClick={()=>void resolveConflict(false)}>Muat versi terbaru</button> <button disabled={busy} className="button secondary" onClick={()=>void resolveConflict(true)}>Simpan sebagai baru</button></div></div>}
      {message && <div className={`form-message ${Object.keys(errors).length ? "error" : ""}`} role="status"><Info size={18} />{message}</div>}
      <Section index="01 / INFORMASI DASAR" title="Produk & produksi" description="Mulai dari identitas produk dan hasil yang siap dijual." icon={<ClipboardList size={20} />}><div className="field-grid two"><Field id="name" label="Nama produk" value={form.name} onChange={name => update({ name })} error={errors.name} placeholder="Contoh: Brownies cokelat" maxLength={120} /><Field id="business" label="Nama usaha atau UMKM" value={form.business} onChange={business => update({ business })} error={errors.business} placeholder="Contoh: Dapur Rasa" /></div><div className="field-grid three"><Field id="batch" label="Ukuran batch" value={form.batch} onChange={batch => { const changed = !!form.batch && batch !== form.batch; update({ batch }); if (changed) setMessage("Ukuran batch berubah. Periksa kembali jumlah bahan, kemasan, upah, dan biaya lainnya; nilai tersebut tidak berubah otomatis."); }} error={errors.batch} placeholder="10" helper="Jumlah hasil yang bisa dijual dari satu kali produksi." /><SelectField id="outputUnit" label="Satuan hasil" value={form.outputUnit} onChange={outputUnit => update({ outputUnit })} options={["box","pack","cup","porsi","buah","botol","lainnya"].map(value => ({ value, label: value === "lainnya" ? "Lainnya" : value }))} />{form.outputUnit === "lainnya" && <Field id="customUnit" label="Nama satuan lainnya" value={form.customUnit} onChange={customUnit => update({ customUnit })} error={errors.customUnit} placeholder="Contoh: loyang" maxLength={30} />}</div><label className="field"><span className="field-label">Catatan produksi <span className="optional">Opsional</span></span><textarea value={form.note} onChange={event => update({ note: event.target.value })} placeholder="Contoh: ukuran box 15 cm" maxLength={501} rows={2} />{errors.note && <small className="field-error">{errors.note}</small>}</label></Section>
      <Section index="02 / BIAYA PRODUKSI" title="Bahan baku" description="Masukkan jumlah yang dipakai untuk batch ini dan harga untuk satuan yang dipilih." icon={<Layers3 size={20} />} foot={<><button className="button add-button" onClick={() => addRow("ingredients")}><Plus size={17} /> Tambah bahan baku</button><div className="section-total"><span>Total bahan baku</span><b>{rupiah(result.B, 2)}</b></div></>}>{errors.ingredients && <div className="inline-warning"><CircleAlert size={15} /> {errors.ingredients}</div>}{form.ingredients.map((item, index) => <div className="cost-row" key={item.id}><RowTop title="Bahan" index={index} onRemove={() => removeRow("ingredients", index)} /><div className="cost-fields ingredient-fields"><Field id={`ingredient-${index}-name`} label="Nama bahan" value={item.name} onChange={name => updateList("ingredients", index, { name })} error={errors[`ingredient-${index}-name`]} placeholder="Contoh: tepung" /><Field id={`ingredient-${index}-quantity`} label="Jumlah digunakan" value={item.quantity} onChange={quantity => updateList("ingredients", index, { quantity })} error={errors[`ingredient-${index}-quantity`]} placeholder="0,5" /><SelectField id={`ingredient-${index}-unit`} label="Satuan" value={item.unit} onChange={value => changeUnit(index, value as Unit)} options={["g","kg","ml","liter","buah"].map(value => ({ value, label: unitLabel(value) }))} /><Field id={`ingredient-${index}-price`} label={`Harga per ${unitLabel(item.unit)}`} value={item.price} onChange={price => updateList("ingredients", index, { price })} onBlur={() => updateList("ingredients", index, { price: moneyInput(item.price) })} error={errors[`ingredient-${index}-price`]} prefix="Rp" placeholder="15.000" /></div><div className="row-subtotal"><span>Subtotal {item.price && parseMoney(item.price) === "0" && <em>Harga Rp0</em>}</span><b>{rupiah(subtotalIngredient(item), 2)}</b></div></div>)}</Section>
      <Section index="03 / BIAYA PRODUKSI" title="Kemasan" description="Box, label, sendok, atau perlengkapan lainnya untuk batch ini." icon={<PackageIcon />} foot={<><button className="button add-button" onClick={() => addRow("packages")}><Plus size={17} /> Tambah kemasan</button><div className="section-total"><span>Total kemasan</span><b>{rupiah(result.K, 2)}</b></div></>}><CategoryStatus value={form.statuses.packages} hasRows={form.packages.length > 0} onChange={value => update({ statuses: { ...form.statuses, packages: value } })} />{form.packages.map((item, index) => <div className="cost-row" key={item.id}><RowTop title="Kemasan" index={index} onRemove={() => removeRow("packages", index)} /><div className="cost-fields three-fields"><Field id={`package-${index}-name`} label="Nama kemasan" value={item.name} onChange={name => updateList("packages", index, { name })} error={errors[`package-${index}-name`]} placeholder="Contoh: box" /><Field id={`package-${index}-quantity`} label="Jumlah" value={item.quantity} onChange={quantity => updateList("packages", index, { quantity })} error={errors[`package-${index}-quantity`]} placeholder="10" /><Field id={`package-${index}-price`} label="Harga per buah" value={item.price} onChange={price => updateList("packages", index, { price })} onBlur={() => updateList("packages", index, { price: moneyInput(item.price) })} error={errors[`package-${index}-price`]} prefix="Rp" placeholder="1.000" /></div><div className="row-subtotal"><span>Subtotal</span><b>{rupiah(subtotalPackage(item), 2)}</b></div></div>)}</Section>
      <Section index="04 / BIAYA PRODUKSI" title="Tenaga kerja" description="Masukkan upah yang dialokasikan untuk satu batch produksi." icon={<Users size={20} />} foot={<><button className="button add-button" onClick={() => addRow("labor")}><Plus size={17} /> Tambah tenaga kerja</button><div className="section-total"><span>Total tenaga kerja</span><b>{rupiah(result.L, 2)}</b></div></>}><CategoryStatus value={form.statuses.labor} hasRows={form.labor.length > 0} onChange={value => update({ statuses: { ...form.statuses, labor: value } })} />{form.labor.map((item, index) => <div className="cost-row" key={item.id}><RowTop title="Pekerjaan" index={index} onRemove={() => removeRow("labor", index)} /><div className="cost-fields three-fields"><Field id={`labor-${index}-name`} label="Keterangan pekerjaan" value={item.name} onChange={name => updateList("labor", index, { name })} error={errors[`labor-${index}-name`]} placeholder="Contoh: produksi" /><Field id={`labor-${index}-people`} label="Jumlah orang" value={item.people} onChange={people => updateList("labor", index, { people })} error={errors[`labor-${index}-people`]} /><Field id={`labor-${index}-wage`} label="Upah per orang untuk batch" value={item.wage} onChange={wage => updateList("labor", index, { wage })} onBlur={() => updateList("labor", index, { wage: moneyInput(item.wage) })} error={errors[`labor-${index}-wage`]} prefix="Rp" placeholder="15.000" /></div><div className="row-subtotal"><span>Subtotal</span><b>{rupiah(subtotalLabor(item), 2)}</b></div></div>)}</Section>
      <Section index="05 / BIAYA PRODUKSI" title="Biaya produksi lainnya" description="Alokasikan listrik, gas, air, dan biaya produksi lain untuk batch ini." icon={<Wallet size={20} />} foot={<><button className="button add-button" onClick={() => addRow("others")}><Plus size={17} /> Tambah biaya</button><div className="section-total"><span>Total biaya lainnya</span><b>{rupiah(result.O, 2)}</b></div></>}><CategoryStatus value={form.statuses.others} hasRows={form.others.length > 0} onChange={value => update({ statuses: { ...form.statuses, others: value } })} />{form.others.map((item, index) => <div className="cost-row" key={item.id}><RowTop title="Biaya" index={index} onRemove={() => removeRow("others", index)} /><div className="cost-fields three-fields"><SelectField id={`other-${index}-type`} label="Jenis biaya" value={item.type} onChange={type => updateList("others", index, { type })} options={["Listrik","Gas","Air","Sewa ruang produksi","Penggunaan alat","Lainnya"].map(value => ({ value, label: value }))} /><Field id={`other-${index}-note`} label={item.type === "Lainnya" ? "Keterangan" : "Keterangan (opsional)"} value={item.note} onChange={note => updateList("others", index, { note })} error={errors[`other-${index}-note`]} placeholder="Rincian singkat" /><Field id={`other-${index}-amount`} label="Biaya untuk batch" value={item.amount} onChange={amount => updateList("others", index, { amount })} onBlur={() => updateList("others", index, { amount: moneyInput(item.amount) })} error={errors[`other-${index}-amount`]} prefix="Rp" placeholder="2.000" /></div><div className="row-subtotal"><span>Subtotal</span><b>{rupiah(subtotalOther(item), 2)}</b></div></div>)}</Section>
      <Section index="06 / PENGATURAN HARGA" title="Pajak penjualan" description="Simulasikan satu pungutan penjualan bila berlaku untuk usaha Anda." icon={<ReceiptText size={20} />}><label className="switch-row"><div><b>Gunakan pajak penjualan</b><span>Nonaktif secara default. Pajak tidak ditambahkan ke HPP.</span></div><input type="checkbox" checked={form.taxEnabled} onChange={event => update({ taxEnabled: event.target.checked })} /><span className="switch-ui" /></label>{form.taxEnabled && <><div className="field-grid two tax-fields"><Field id="taxName" label="Nama pajak" value={form.taxName} onChange={taxName => update({ taxName })} error={errors.taxName} placeholder="Contoh: PBJT" maxLength={60} /><Field id="taxRate" label="Tarif pajak" value={form.taxRate} onChange={taxRate => update({ taxRate })} error={errors.taxRate} suffix="%" placeholder="10" /></div><div className="field-label spaced">Perlakuan harga</div><div className="choice-row"><button type="button" className={form.taxMode === "exclusive" ? "chosen" : ""} onClick={() => changeTaxMode("exclusive")}><span className="radio-dot" /> Belum termasuk pajak</button><button type="button" className={form.taxMode === "inclusive" ? "chosen" : ""} onClick={() => changeTaxMode("inclusive")}><span className="radio-dot" /> Sudah termasuk pajak</button></div><p className="form-help"><Info size={15} /> Gunakan nama dan tarif yang berlaku untuk usaha Anda. Dasar pajak adalah harga sebelum pajak per satuan.</p></>}</Section>
      <Section index="07 / PENGATURAN HARGA" title="Harga jual & margin" description="Atur target margin dan lihat dampaknya pada saran harga jual." icon={<FlaskConical size={20} />}><div className="field-grid two"><Field id="margin" label="Target margin" value={form.margin} onChange={margin => update({ margin })} error={errors.margin} suffix="%" helper="Bagian harga jual sebelum pajak yang tersisa setelah biaya produksi." /><SelectField id="rounding" label="Pembulatan saran ke atas" value={form.rounding} onChange={rounding => update({ rounding: rounding as Calculation["rounding"] })} options={[{ value: "1", label: "Rp1" }, { value: "500", label: "Rp500" }, { value: "1000", label: "Rp1.000" }]} /></div><div className="quick-margin"><span>Pilihan cepat</span>{["20","30","40"].map(value => <button key={value} className={form.margin === value ? "selected" : ""} onClick={() => update({ margin: value })}>{value}%</button>)}</div><div className="price-setting"><Field id="manualPrice" label={priceLabel} value={form.manualPrice} onChange={manualPrice => update({ manualPrice })} onBlur={() => update({ manualPrice: moneyInput(form.manualPrice) })} error={errors.manualPrice} prefix="Rp" placeholder="Kosongkan untuk memakai saran" helper="Opsional. Harga pilihan tidak dibulatkan otomatis." /><div className="suggestion-box"><span>Saran harga jual</span><strong>{result.canPrice ? rupiah(result.suggested) : "—"}</strong><small>{form.taxEnabled && form.taxMode === "inclusive" ? "Termasuk pajak" : form.taxEnabled ? "Sebelum pajak" : "Per satuan hasil"}</small></div></div></Section>
      <div className="editor-actions"><button disabled={busy||conflict} className="button secondary" onClick={saveDraft}><Save size={17} /> Simpan draft</button><button disabled={busy||conflict} className="button primary" onClick={finalize}><Check size={18} /> {busy?"Memproses...":"Hitung dan simpan"} <ArrowRight size={16} /></button></div>
    </div><aside className="editor-aside"><div className="preview-card"><div className="preview-head"><div><span className="eyebrow">RINGKASAN LANGSUNG</span><h2>Pratinjau HPP</h2></div><span className="live-dot" /></div><div className="preview-hero"><span>HPP per {outputLabel(form)}</span><strong>{form.batch && result.T.gt(0) ? rupiah(result.C, 2) : "—"}</strong><small>Pratinjau belum disimpan</small></div><div className="preview-lines"><div><span>Bahan baku</span><b>{rupiah(result.B, 2)}</b></div><div><span>Kemasan</span><b>{rupiah(result.K, 2)}</b></div><div><span>Tenaga kerja</span><b>{rupiah(result.L, 2)}</b></div><div><span>Biaya lainnya</span><b>{rupiah(result.O, 2)}</b></div></div><div className="preview-total"><span>Total biaya batch</span><b>{rupiah(result.T, 2)}</b></div><div className="preview-price"><span>Saran harga jual</span><strong>{result.canPrice ? rupiah(result.suggested) : "—"}</strong><small>Target margin {form.margin || "0"}% · pembulatan {rupiah(form.rounding)}</small></div>{result.missing.length > 0 && <div className="preview-warning"><CircleAlert size={17} /><span>Belum dihitung: {result.missing.join(", ")}</span></div>}{result.canPrice && <div className={`preview-status ${result.priceStatus === "Belum menutup biaya" ? "bad" : ""}`}><CircleCheck size={16} /> {result.priceStatus}</div>}</div><div className="aside-note"><Sparkles size={17} /><span>Margin dihitung dari harga sebelum pajak. Angka di sini adalah estimasi berdasarkan biaya yang Anda isi.</span></div></aside></div>
  </Shell>;
}

function PackageIcon() { return <Layers3 size={20} />; }

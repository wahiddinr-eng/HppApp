"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Sparkles, Target, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { calculateChannelPrice, type ChannelSetting } from "@/lib/channel-pricing";
import { percent, rupiah } from "@/lib/hpp";
import { PageTop, Shell } from "./shell";
import advice from "./pricing-advice.module.css";

type Response = {
  calculation: { id: string; name: string; unit: string; revision: number; costPerUnit: string };
  settings: ChannelSetting[];
};

const fields: { key: keyof Pick<ChannelSetting, "commissionRate" | "promoRate" | "otherRate" | "fixedFee" | "extraCost" | "targetMargin">; label: string; suffix: string; help: string }[] = [
  { key: "commissionRate", label: "Komisi platform", suffix: "%", help: "Persentase dari harga menu" },
  { key: "promoRate", label: "Promo ditanggung usaha", suffix: "%", help: "Persentase dari harga menu" },
  { key: "otherRate", label: "Biaya persentase lain", suffix: "%", help: "Misalnya biaya layanan" },
  { key: "fixedFee", label: "Biaya tetap per pesanan", suffix: "Rp", help: "Misalnya potongan tetap atau subsidi" },
  { key: "extraCost", label: "Biaya tambahan per porsi", suffix: "Rp", help: "Di luar HPP, misalnya kemasan khusus" },
  { key: "targetMargin", label: "Target margin bersih", suffix: "%", help: "Dari penerimaan setelah potongan platform" },
];

export function ChannelPricing({ id }: { id: string }) {
  const [data, setData] = useState<Response>();
  const [settings, setSettings] = useState<ChannelSetting[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    void api<Response>(`/api/calculations/${id}/channels`).then((response) => {
      if (alive) { setData(response); setSettings(response.settings); }
    }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat harga kanal."); });
    return () => { alive = false; };
  }, [id]);

  function update(index: number, key: keyof ChannelSetting, value: string) {
    setNotice("");
    setSettings((current) => current.map((item, position) => position === index ? { ...item, [key]: key === "name" ? value : value.replace(",", ".") } : item));
  }

  async function save() {
    setSaving(true); setError(""); setNotice("");
    try {
      await api(`/api/calculations/${id}/channels`, { method: "PUT", body: JSON.stringify({ settings }) });
      setNotice("Pengaturan harga kanal tersimpan.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal menyimpan pengaturan."); }
    finally { setSaving(false); }
  }

  return <Shell>
    <PageTop eyebrow="HARGA JUAL / KANAL" title="Harga untuk aplikasi pesan-antar" description="Simulasikan harga menu berdasarkan HPP produk Anda dan potongan yang benar-benar berlaku pada akun merchant." actions={<><Link href="/app/profit-target" className="button secondary"><Target size={16} /> Buat target untung</Link><Link href={`/app/calculations/${id}/report`} className="button secondary"><ArrowLeft size={16} /> Kembali ke report</Link></>} />
    {error && <div className="form-message error" role="alert">{error}</div>}
    {notice && <div className="form-message" role="status">{notice}</div>}
    {!data ? <div className="panel channel-loading">{error ? "Simulasi belum dapat ditampilkan." : "Memuat resep dan pengaturan kanal..."}</div> : <>
      <div className="channel-intro panel">
        <div><span>PRODUK & REVISI</span><strong>{data.calculation.name}</strong><small>Revisi r{data.calculation.revision} · per {data.calculation.unit}</small></div>
        <div><span>HPP PER {data.calculation.unit.toUpperCase()}</span><strong>{rupiah(data.calculation.costPerUnit, 2)}</strong><small>Diambil dari hasil perhitungan tersimpan</small></div>
      </div>
      <div className={advice.starterNote}><Sparkles size={16} aria-hidden="true"/><div><strong>Baru mulai? Gunakan margin 30% sebagai titik awal.</strong><p>Ubah target per kanal sesuai biaya dan harga yang masuk akal bagi pembeli. Ini margin per produk setelah potongan, bukan jaminan laba usaha; cek juga biaya tetap di <Link href="/app/profit-target">Target Untung</Link>.</p></div></div>
      <div className="channel-note">Tarif setiap platform berbeda menurut kontrak, promo, dan periode. Isi sesuai dashboard merchant Anda; preset awal bukan tarif resmi. Simulasi menganggap satu porsi per pesanan, seluruh persentase dihitung dari harga menu, dan biaya tetap dibebankan ke satu porsi. Pajak penjualan belum dihitung.</div>
      <div className="channel-grid">
        {settings.map((item, index) => {
          let result: ReturnType<typeof calculateChannelPrice> | undefined;
          let problem = "";
          try { result = calculateChannelPrice(data.calculation.costPerUnit, item); }
          catch (cause) { problem = cause instanceof Error ? cause.message : "Periksa nilai biaya dan tarif."; }
          return <section key={item.id} className="panel channel-card" aria-label={`Harga ${item.name}`}>
            <div className="channel-card-head"><div><label htmlFor={`channel-name-${item.id}`}>Nama kanal</label><input id={`channel-name-${item.id}`} value={item.name} maxLength={40} onChange={(event) => update(index, "name", event.target.value)} /></div><button type="button" className="icon-button" aria-label={`Hapus ${item.name}`} onClick={() => setSettings((current) => current.filter((row) => row.id !== item.id))}><Trash2 size={17} /></button></div>
            <div className="channel-fields">{fields.map((field) => <label key={field.key} className="channel-field"><span>{field.label}</span><div><input aria-label={`${field.label} ${item.name}`} inputMode="decimal" value={item[field.key]} onChange={(event) => update(index, field.key, event.target.value)} /><b>{field.suffix}</b></div><small>{field.help}</small></label>)}
              <label className="channel-field"><span>Pembulatan ke atas</span><select aria-label={`Pembulatan ${item.name}`} value={item.rounding} onChange={(event) => update(index, "rounding", event.target.value)}><option value="1">Rp1</option><option value="500">Rp500</option><option value="1000">Rp1.000</option></select></label>
            </div>
            {result ? <div className="channel-result"><span>HARGA MENU DISARANKAN</span><strong>{rupiah(result.menuPrice)}</strong><div><span>Harga minimum agar tidak rugi per {data.calculation.unit}</span><b>{rupiah(result.breakEven)}</b></div><div><span>Potongan persentase ({result.totalRate}%)</span><b>{rupiah(result.variableFees)}</b></div><div><span>Diterima setelah semua potongan</span><b>{rupiah(result.netRevenue)}</b></div><div><span>Estimasi laba per {data.calculation.unit}</span><b>{rupiah(result.profit)}</b></div><small>Margin dari penerimaan bersih: {result.actualMargin}%</small>
              <section className={advice.promoLimits} aria-label={`Batas promo ${item.name}`}>
                <div className={advice.promoLimit}><span>Promo total maks. tanpa rugi per porsi</span><strong>{percent(result.maxPromoNoLossRate)}</strong><small>Batas impas, bukan target laba usaha.</small></div>
                <div className={advice.promoLimit}><span>Promo total maks. sambil menjaga margin {item.targetMargin}%</span><strong>{percent(result.maxPromoTargetRate)}</strong><small>Gunakan batas ini jika ingin mempertahankan target.</small></div>
              </section>
              <p className={advice.promoFoot}>Batas berlaku untuk harga saran {rupiah(result.menuPrice)} dan <strong>sudah termasuk promo {percent(item.promoRate)}</strong> yang Anda isi. Jika harga menu, biaya, atau promo berubah, batas ikut dihitung ulang. Belum termasuk biaya tetap bulanan.</p>
            </div> : <div className="form-message error" role="alert">{problem}</div>}
          </section>;
        })}
      </div>
      <div className="channel-actions"><button className="button secondary" type="button" disabled={settings.length >= 8} onClick={() => setSettings((current) => [...current, { id: `custom-${crypto.randomUUID()}`, name: "Kanal lainnya", commissionRate: "0", promoRate: "0", otherRate: "0", fixedFee: "0", extraCost: "0", targetMargin: current[0]?.targetMargin || "30", rounding: "500" }])}><Plus size={16} /> Tambah kanal</button><button className="button primary" type="button" disabled={saving} onClick={() => void save()}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan pengaturan"}</button></div>
    </>}
  </Shell>;
}

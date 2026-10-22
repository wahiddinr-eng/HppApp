"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import { ArrowRight, CircleAlert, Save, Target, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/hpp";
import { calculateProfitTarget, profitTargetSchema, type ProfitTargetInput, type RecentSales } from "@/lib/profit-target";
import { PageTop, Shell } from "./shell";
import styles from "./profit-target.module.css";

type Response = {
  saved: { settings: ProfitTargetInput; version: number; updatedAt: string } | null;
  actual: { month: string; recordedDays: number; units: number; contribution: string };
  recent: RecentSales & { from: string; to: string };
};
const initial: ProfitTargetInput = { monthlyFixedCost: "0", monthlyProfitGoal: "0", operatingDays: 26 };

export function ProfitTarget() {
  const [data, setData] = useState<Response>();
  const [draft, setDraft] = useState<ProfitTargetInput>(initial);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    void api<Response>("/api/profit-target").then(response => {
      if (!alive) return;
      setData(response);
      setDraft(response.saved?.settings ?? initial);
      setVersion(response.saved?.version ?? 0);
    }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : "Target gagal dimuat."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const parsed = profitTargetSchema.safeParse(draft);
  const validationMessage = !parsed.success ? parsed.error.issues[0]?.message : "";
  const projection = useMemo(() => {
    const valid = profitTargetSchema.safeParse(draft);
    if (!valid.success) return null;
    try { return calculateProfitTarget(valid.data, data?.recent); }
    catch { return null; }
  }, [draft, data?.recent]);
  const update = (patch: Partial<ProfitTargetInput>) => { setDraft(current => ({ ...current, ...patch })); setNotice(""); };
  const save = async () => {
    if (!parsed.success || !projection) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await api<{ saved: NonNullable<Response["saved"]> }>("/api/profit-target", {
        method: "PUT", body: JSON.stringify({ version, settings: parsed.data }),
      });
      setVersion(response.saved.version);
      setNotice("Target usaha tersimpan. Perkiraan produk akan mengikuti rekap penjualan terbaru.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal menyimpan target."); }
    finally { setSaving(false); }
  };
  const actual = data?.actual;
  const remainingBreakEven = actual && projection
    ? rupiah(Decimal.max(0, new Decimal(projection.breakEvenMonthlyContribution).minus(actual.contribution))) : "";
  const remainingGoal = actual && projection
    ? rupiah(Decimal.max(0, new Decimal(projection.targetMonthlyContribution).minus(actual.contribution))) : "";

  return <Shell>
    <PageTop eyebrow="SIAPKAN HARGA / RENCANA USAHA" title="Target Untung & Titik Impas"
      description="Tetapkan target hasil usaha secara keseluruhan, tanpa membagi target per menu atau kanal."
      actions={<Link href="/app/sales/analysis" className="button secondary">Lihat analisis penjualan <ArrowRight size={16} /></Link>} />
    <div className={styles.page}>
      {error && <div className="form-message error" role="alert">{error}</div>}
      {notice && <div className="form-message" role="status">{notice}</div>}
      {loading ? <div className={styles.empty} role="status">Memuat rencana usaha...</div> : data && <>
        <div className={styles.intro}><CircleAlert size={19} /><p><strong>Isi tiga angka saja.</strong> Biaya tetap adalah pengeluaran bulanan di luar HPP produk, misalnya sewa tempat. Jangan masukkan lagi biaya yang sudah dihitung dalam resep.</p></div>
        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.heading}><span>01</span><div><h2>Rencana usaha Anda</h2><p>Angka bisa diubah kapan saja. Hasil di samping mengikuti isian Anda.</p></div></div>
            <div className={styles.fields}>
              <label><span>Biaya tetap bulanan</span><div className={styles.moneyField}><b>Rp</b><input aria-label="Biaya tetap bulanan" type="number" inputMode="decimal" min="0" max="999999999999" step="0.01" value={draft.monthlyFixedCost} onChange={event => update({ monthlyFixedCost: event.target.value })} /></div><small>Misalnya sewa, internet, atau gaji tetap yang belum masuk HPP.</small></label>
              <label><span>Penghasilan yang ingin dicapai per bulan</span><div className={styles.moneyField}><b>Rp</b><input aria-label="Penghasilan yang ingin dicapai per bulan" type="number" inputMode="decimal" min="0" max="999999999999" step="0.01" value={draft.monthlyProfitGoal} onChange={event => update({ monthlyProfitGoal: event.target.value })} /></div><small>Setelah HPP, potongan penjualan, dan biaya tetap di atas.</small></label>
              <label><span>Hari berjualan per bulan</span><div className={styles.daysField}><input aria-label="Hari berjualan per bulan" type="number" min="1" max="31" step="1" value={draft.operatingDays} onChange={event => update({ operatingDays: Number(event.target.value) })} /><b>hari</b></div><small>Dipakai untuk membagi kebutuhan bulanan menjadi target per hari.</small></label>
            </div>
            {validationMessage && <p className={styles.fieldError} role="alert">{validationMessage}</p>}
            <div className={styles.actions}><button className="button primary" type="button" disabled={saving || !projection} onClick={() => void save()}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan target usaha"}</button></div>
          </section>
          <div className={styles.resultColumn}>
            <section className={styles.result}><div className={styles.resultTitle}><span>HASIL PERENCANAAN</span><Target size={22} /></div>
              {projection ? <>
                <div className={styles.resultBlock}><span>AGAR BIAYA TETAP TERTUTUP</span><strong>{rupiah(projection.breakEvenDailyContribution)} <small>/ hari</small></strong><p>Perlu tersisa {rupiah(projection.breakEvenMonthlyContribution)} per bulan setelah HPP dan potongan penjualan.</p></div>
                <div className={styles.resultBlock}><span>AGAR PENGHASILAN TARGET TERCAPAI</span><strong>{rupiah(projection.targetDailyContribution)} <small>/ hari</small></strong><p>Perlu tersisa {rupiah(projection.targetMonthlyContribution)} per bulan setelah HPP dan potongan penjualan.</p></div>
                <div className={styles.formula}>{rupiah(draft.monthlyFixedCost)} biaya tetap + {rupiah(draft.monthlyProfitGoal)} target penghasilan = <b>{rupiah(projection.targetMonthlyContribution)}</b> kebutuhan per bulan.</div>
              </> : <div className={styles.resultEmpty}>Lengkapi tiga angka di samping agar target dapat dihitung.</div>}
            </section>
            {projection && <section className={styles.estimate}>
              <div className={styles.estimateHead}><TrendingUp size={19} /><span>PERKIRAAN JUMLAH PRODUK</span></div>
              {projection.estimatedUnits ? <><strong>{projection.estimatedUnits.targetDaily.toLocaleString("id-ID")} produk <small>/ hari</small></strong>
                <p>Untuk mencapai target penghasilan. Perkiraan impas: {projection.estimatedUnits.breakEvenDaily.toLocaleString("id-ID")} produk/hari.</p>
                <small>Berdasarkan rata-rata hasil {rupiah(projection.estimatedUnits.averageContribution)} per produk dari {data.recent.units.toLocaleString("id-ID")} produk di {data.recent.recordedDays} hari yang direkap dalam 30 hari terakhir. Semua menu dan kanal digabung; perubahan harga/HPP dapat membuat perkiraan ini bergeser.</small></>
                : <><h3>{projection.historyStatus === "nonpositive" ? "Harga dan biaya perlu ditinjau" : "Belum cukup data penjualan"}</h3>
                  <p>{projection.historyStatus === "nonpositive"
                    ? "Rata-rata hasil setelah HPP dan potongan belum positif, sehingga target jumlah produk tidak dapat dihitung dengan aman."
                    : "Catat sedikitnya 7 hari dan 20 produk terjual untuk melihat perkiraan jumlah produk. Target uang di atas tetap bisa digunakan sekarang."}</p>
                  <Link href="/app/sales">Isi Penjualan Harian <ArrowRight size={14} /></Link></>}
            </section>}
            {actual && projection && <section className={styles.actual}><div className={styles.actualHead}><span>REALISASI BULAN INI</span><Link href="/app/sales/analysis">Lihat analisis <ArrowRight size={14} /></Link></div>
              <strong>{rupiah(actual.contribution)}</strong><p>Hasil setelah HPP dan potongan dari {actual.units.toLocaleString("id-ID")} produk pada {actual.recordedDays} hari yang direkap.</p>
              <div><span>Sisa menuju titik impas</span><b>{remainingBreakEven}</b></div>
              <div><span>Sisa menuju target penghasilan</span><b>{remainingGoal}</b></div>
              <small>Hari yang belum direkap tidak dianggap nol. Realisasi memakai angka penjualan dan HPP yang tercatat saat rekap dibuat.</small>
            </section>}
            <div className={styles.caveat}>Target ini adalah <strong>simulasi usaha</strong>, bukan jaminan laba atau laporan akuntansi. Biaya lain yang belum dimasukkan, termasuk pajak penjualan, dapat mengubah hasil akhir. Target harian dibulatkan ke atas.</div>
          </div>
        </div>
      </>}
    </div>
  </Shell>;
}

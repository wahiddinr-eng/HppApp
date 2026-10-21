"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChartColumnIncreasing, CircleHelp, ShoppingBag, Store, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { businessToday } from "@/lib/sales";
import { rupiah } from "@/lib/hpp";
import { PageTop, Shell } from "./shell";
import styles from "./sales.module.css";

type Metrics = { orders: number; units: number; gross: string; deductions: string; net: string; cost: string; contribution: string };
type Analysis = { from: string; to: string; previousRange: { from: string; to: string };
  current: { total: Metrics; recordedDays: number; channels: ({ name: string } & Metrics)[]; menus: ({ id: string; name: string; unit: string } & Metrics)[]; days: ({ date: string } & Metrics)[] };
  previous: { total: Metrics; recordedDays: number } };
const iso = (daysBefore: number, today: string) => new Date(Date.parse(`${today}T00:00:00Z`) - daysBefore * 86400000).toISOString().slice(0, 10);
const dateLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const chartDate = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const shortAmount = (value: string) => new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 0 }).format(Number(value));
function trend(now: number, before: number) {
  if (!before) return null;
  const percent = Math.round((now - before) / before * 100);
  return `${percent > 0 ? "+" : ""}${percent}% dari periode sebelumnya`;
}

export function SalesAnalysis() {
  const today = businessToday();
  const [from, setFrom] = useState(iso(29, today));
  const [to, setTo] = useState(today);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [preset, setPreset] = useState("30");
  const [data, setData] = useState<Analysis>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(""); setData(undefined);
    void api<Analysis>(`/api/sales/analysis?from=${from}&to=${to}`).then(result => { if (alive) setData(result); })
      .catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : "Analisis gagal dimuat."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [from, to]);
  function choosePreset(value: string) {
    setPreset(value);
    const start = value === "month" ? `${today.slice(0, 7)}-01` : iso(Number(value) - 1, today);
    setDraftFrom(start); setDraftTo(today); setFrom(start); setTo(today);
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draftFrom > draftTo) { setError("Tanggal akhir harus sama atau setelah tanggal awal."); return; }
    setPreset("custom"); setFrom(draftFrom); setTo(draftTo);
  }
  const total = data?.current.total;
  const chart = data?.current.days.slice(-30) ?? [];
  const max = useMemo(() => Math.max(1, ...chart.map(day => Number(day.net))), [chart]);
  const calendarDays = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  return <Shell><PageTop eyebrow="PENJUALAN / ANALISIS" title="Analisis Penjualan" description="Lihat produk terlaris dan kanal pemesanan berdasarkan rekap harian Anda."
    actions={<Link href="/app/sales" className="button primary"><CalendarDays size={16} /> Isi penjualan harian</Link>} />
    <div className={styles.analysis}>
      <section className={styles.period}><div><span className={styles.eyebrow}>PERIODE ANALISIS</span><h2>Pilih rentang waktu</h2></div><div className={styles.presets}>{[["7", "7 hari"], ["30", "30 hari"], ["month", "Bulan ini"]].map(([value, label]) => <button type="button" key={value} className={preset === value ? styles.activePreset : ""} onClick={() => choosePreset(value)}>{label}</button>)}</div>
        <form onSubmit={apply}><label>Dari<input aria-label="Dari tanggal" type="date" min="2020-01-01" max={today} value={draftFrom} onChange={event => setDraftFrom(event.target.value)} required /></label><label>Sampai<input aria-label="Sampai tanggal" type="date" min="2020-01-01" max={today} value={draftTo} onChange={event => setDraftTo(event.target.value)} required /></label><button type="submit" className="button secondary">Terapkan</button></form></section>
      {error && <div className="form-message error" role="alert">{error}</div>}
      {loading && <div className={styles.empty} role="status">Memuat analisis...</div>}
      {!loading && data && <>
        <div className={styles.periodCaption}><CalendarDays size={15} /> {dateLabel(data.from)} – {dateLabel(data.to)} <span>·</span> {data.current.recordedDays} dari {calendarDays} hari memiliki rekap</div>
        {!data.current.recordedDays ? <div className={styles.empty}><ChartColumnIncreasing size={33} /><h2>Belum ada rekap pada periode ini</h2><p>Catat penjualan harian terlebih dahulu. Hari yang belum dicatat tidak dianggap sebagai nol penjualan.</p><Link href="/app/sales" className="button primary">Isi rekap pertama <ArrowRight size={16} /></Link></div> : <>
          <div className={styles.statGrid}>
            <div className={styles.stat}><div className={styles.statIcon}><ShoppingBag size={20} /></div><span>Jumlah pesanan</span><strong>{total!.orders.toLocaleString("id-ID")}</strong><small>{trend(total!.orders, data.previous.total.orders) ?? "Belum ada data pembanding"}</small></div>
            <div className={styles.stat}><div className={styles.statIcon}><Store size={20} /></div><span>Produk terjual</span><strong>{total!.units.toLocaleString("id-ID")}</strong><small>{trend(total!.units, data.previous.total.units) ?? "Di semua kanal"}</small></div>
            <div className={styles.stat}><div className={styles.statIcon}><TrendingUp size={20} /></div><span>Penerimaan setelah potongan</span><strong>{rupiah(total!.net)}</strong><small>Penjualan kotor {rupiah(total!.gross)}</small></div>
            <div className={styles.stat}><div className={styles.statIcon}><ChartColumnIncreasing size={20} /></div><span>Perkiraan hasil setelah HPP</span><strong>{rupiah(total!.contribution)}</strong><small>Belum termasuk biaya usaha di luar HPP</small></div>
          </div>
          <div className={styles.analysisGrid}>
            <section className={styles.dataPanel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>PERFORMA MENU</span><h2>Menu paling laku</h2><p>Diurutkan berdasarkan jumlah produk terjual.</p></div><ShoppingBag size={20} /></div>
              {data.current.menus.length ? <div className={styles.rankList}>{data.current.menus.map((menu, index) => <div className={styles.rankRow} key={menu.id}><span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span><div><strong>{menu.name}</strong><small>Penerimaan {rupiah(menu.net)} · hasil setelah HPP &amp; alokasi potongan {rupiah(menu.contribution)}</small></div><b>{menu.units} {menu.unit}</b></div>)}</div> : <p className={styles.noData}>Belum ada produk terjual di periode ini.</p>}
              <p className={styles.panelNote}>Potongan kanal dialokasikan ke menu menurut porsi penjualan kotor tiap menu.</p></section>
            <section className={styles.dataPanel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>SUMBER PEMESANAN</span><h2>Kanal tersibuk</h2><p>Diurutkan berdasarkan jumlah pesanan, bukan jumlah produk.</p></div><Store size={20} /></div>
              {data.current.channels.length ? <div className={styles.rankList}>{data.current.channels.map((channel, index) => <div className={styles.rankRow} key={channel.name}><span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span><div><strong>{channel.name}</strong><small>{channel.units} produk · penerimaan {rupiah(channel.net)}</small></div><b>{channel.orders} pesanan</b></div>)}</div> : <p className={styles.noData}>Belum ada pesanan di periode ini.</p>}
              <p className={styles.panelNote}>Nama kanal mengikuti yang diisi pada rekap harian.</p></section>
          </div>
          <section className={styles.dataPanel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>TREN PENJUALAN</span><h2>Penerimaan per hari</h2><p>{chart.length < data.current.days.length ? "Menampilkan 30 hari tercatat terakhir dari periode terpilih." : "Berdasarkan hari yang sudah dicatat."}</p></div><ChartColumnIncreasing size={20} /></div>
            <div className={styles.chart} role="img" aria-label="Grafik penerimaan pada hari yang telah dicatat; geser untuk melihat tanggal lainnya">{chart.map(day => <div key={day.date} title={`${dateLabel(day.date)} · ${rupiah(day.net)} · ${day.orders} pesanan`}><span>{shortAmount(day.net)}</span><i style={{ height: `${Math.max(Number(day.net) ? 5 : 2, Number(day.net) / max * 100)}%` }} /><small>{chartDate(day.date)}</small></div>)}</div><p className={styles.chartHint}>Geser grafik untuk melihat tanggal lainnya.</p></section>
          <section className={styles.dataPanel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>RIWAYAT</span><h2>Rekap yang tersimpan</h2><p>Pilih tanggal untuk melihat rincian atau memperbaiki angka.</p></div><CircleHelp size={20} /></div>
            <div className={styles.dayList}>{data.current.days.slice().reverse().map(day => <Link href={`/app/sales?date=${day.date}`} key={day.date}><span><strong>{dateLabel(day.date)}</strong><small>{day.orders} pesanan · {day.units} produk</small></span><b>{rupiah(day.net)}</b><ArrowRight size={16} /></Link>)}</div></section>
        </>}
      </>}
    </div>
  </Shell>;
}

"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Decimal from "decimal.js";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChartColumnIncreasing, Plus, Save, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { businessToday, type SalesDay } from "@/lib/sales";
import { rupiah } from "@/lib/hpp";
import { PageTop, Shell } from "./shell";
import styles from "./sales.module.css";

type Product = { id: string; name: string; unit: string; revision: number; cost: string; price: string };
type DraftLine = { calculationId: string; quantity: string; gross: string; unitCost: string };
type DraftChannel = { channel: string; orders: string; deductions: string; items: DraftLine[] };
type DayResponse = { day: SalesDay | null; products: Product[] };
type History = { current: { days: { date: string; orders: number; units: number; net: string }[] } };
const knownChannels = ["Langsung", "WhatsApp", "GoFood", "ShopeeFood", "GrabFood"];
const dateLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const decimal = (value: string) => { try { return new Decimal(value || 0); } catch { return new Decimal(0); } };

export function SalesDayEditor() {
  const today = businessToday();
  const [date, setDate] = useState(today);
  const [version, setVersion] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [channels, setChannels] = useState<DraftChannel[]>([]);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<History["current"]["days"]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("date");
    if (requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today) setDate(requested);
  }, [today]);
  const loadHistory = useCallback(async () => {
    const from = new Date(Date.parse(`${businessToday()}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
    const result = await api<History>(`/api/sales/analysis?from=${from}&to=${businessToday()}`);
    setHistory(result.current.days.slice().reverse());
  }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(""); setNotice("");
    void api<DayResponse>(`/api/sales/day?date=${date}`).then(result => {
      if (!alive) return;
      setProducts(result.products);
      setVersion(result.day?.version ?? 0);
      setNote(result.day?.note ?? "");
      setChannels((result.day?.channels ?? []).map(channel => ({ channel: channel.channel,
        orders: String(channel.orders), deductions: channel.deductions,
        items: channel.items.map(item => ({ calculationId: item.calculationId, quantity: String(item.quantity), gross: item.gross, unitCost: item.unitCost })) })));
    }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : "Rekap gagal dimuat."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [date]);
  useEffect(() => { void loadHistory().catch(() => undefined); }, [loadHistory]);

  const totals = useMemo(() => {
    let gross = new Decimal(0), deductions = new Decimal(0), cost = new Decimal(0), orders = 0, units = 0;
    for (const channel of channels) {
      orders += Number(channel.orders) || 0;
      deductions = deductions.plus(decimal(channel.deductions));
      for (const item of channel.items) {
        gross = gross.plus(decimal(item.gross)); units += Number(item.quantity) || 0;
        cost = cost.plus(decimal(item.unitCost).mul(Number(item.quantity) || 0));
      }
    }
    return { orders, units, gross: gross.toFixed(2), deductions: deductions.toFixed(2),
      net: gross.minus(deductions).toFixed(2), contribution: gross.minus(deductions).minus(cost).toFixed(2) };
  }, [channels]);

  function addChannel() {
    const channel = knownChannels.find(value => !channels.some(item => item.channel.toLowerCase() === value.toLowerCase())) || "Kanal lainnya";
    const product = products[0];
    if (!product) return;
    setChannels(current => [...current, { channel, orders: "1", deductions: "0",
      items: [{ calculationId: product.id, quantity: "1", gross: product.price, unitCost: product.cost }] }]);
  }
  function updateChannel(index: number, patch: Partial<DraftChannel>) {
    setChannels(current => current.map((channel, position) => position === index ? { ...channel, ...patch } : channel));
  }
  function updateLine(channelIndex: number, itemIndex: number, patch: Partial<DraftLine>) {
    setChannels(current => current.map((channel, position) => position === channelIndex ? {
      ...channel, items: channel.items.map((item, at) => at === itemIndex ? { ...item, ...patch } : item),
    } : channel));
  }
  function chooseProduct(channelIndex: number, itemIndex: number, id: string) {
    const product = products.find(item => item.id === id);
    if (product) updateLine(channelIndex, itemIndex, { calculationId: id, gross: decimal(product.price).mul(Number(channels[channelIndex].items[itemIndex].quantity) || 1).toFixed(2), unitCost: product.cost });
  }
  function changeQuantity(channelIndex: number, itemIndex: number, value: string) {
    const item = channels[channelIndex].items[itemIndex];
    const product = products.find(row => row.id === item.calculationId);
    const next: Partial<DraftLine> = { quantity: value };
    if (product && decimal(item.gross).eq(decimal(product.price).mul(Number(item.quantity) || 0)))
      next.gross = decimal(product.price).mul(Number(value) || 0).toFixed(2);
    updateLine(channelIndex, itemIndex, next);
  }
  function addLine(channelIndex: number) {
    const used = new Set(channels[channelIndex].items.map(item => item.calculationId));
    const product = products.find(item => !used.has(item.id));
    if (!product) return;
    updateChannel(channelIndex, { items: [...channels[channelIndex].items,
      { calculationId: product.id, quantity: "1", gross: product.price, unitCost: product.cost }] });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const result = await api<{ day: SalesDay }>("/api/sales/day", { method: "PUT", body: JSON.stringify({ date, version, note,
        channels: channels.map(channel => ({ channel: channel.channel.trim(), orders: Number(channel.orders), deductions: channel.deductions || "0",
          items: channel.items.map(item => ({ calculationId: item.calculationId, quantity: Number(item.quantity), gross: item.gross || "0" })) })) }) });
      setVersion(result.day.version);
      setNotice(channels.length ? "Rekap penjualan tersimpan." : "Hari tanpa penjualan tercatat.");
      void loadHistory().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof ApiError ? Object.values(cause.fieldErrors || {})[0] || cause.message : cause instanceof Error ? cause.message : "Gagal menyimpan rekap.");
    } finally { setSaving(false); }
  }

  return <Shell><PageTop eyebrow="PENJUALAN / HARIAN" title="Penjualan Harian" description="Catat hasil jualan, lalu lihat menu dan kanal yang paling membantu usaha Anda."
    actions={<Link href="/app/sales/analysis" className="button secondary"><ChartColumnIncreasing size={16} /> Lihat analisis</Link>} />
    <div className={styles.layout}>
      <form onSubmit={(event) => void save(event)} className={styles.main}>
        {error && <div className="form-message error" role="alert">{error}</div>}
        {notice && <div className="form-message" role="status">{notice}</div>}
        <div className={styles.dayHeader}><div><span className={styles.eyebrow}>REKAP TANGGAL</span><h2>{dateLabel(date)}</h2><p>{version ? `Sudah tersimpan · perubahan ke-${version}` : "Belum ada rekap untuk tanggal ini"}</p></div>
          <label>Tanggal penjualan<input type="date" value={date} max={today} min="2020-01-01" onChange={event => setDate(event.target.value)} aria-label="Tanggal penjualan" /></label></div>
        {loading ? <div className={styles.empty}>Memuat rekap...</div> : !products.length ? <div className={styles.empty}><h3>Hitung HPP produk terlebih dahulu</h3><p>Produk yang sudah memiliki hasil HPP dapat dipilih dalam rekap penjualan.</p><Link href="/app/calculations/new" className="button primary">Buat perhitungan HPP <ArrowRight size={16} /></Link></div> : <>
          <div className={styles.explainer}>Isi jumlah pesanan per kanal, lalu produk yang terjual. Satu pesanan dapat berisi beberapa produk. Nominal penjualan dapat disesuaikan dengan harga yang benar-benar diterima sebelum potongan.</div>
          {channels.map((channel, channelIndex) => <section className={styles.channelCard} key={`${date}-${channelIndex}`}>
            <div className={styles.channelTop}><div><span className={styles.eyebrow}>KANAL {channelIndex + 1}</span><h3>{channel.channel || "Kanal penjualan"}</h3></div><button type="button" className={styles.iconButton} aria-label={`Hapus kanal ${channel.channel}`} onClick={() => setChannels(current => current.filter((_, index) => index !== channelIndex))}><Trash2 size={17} /></button></div>
            <div className={styles.channelFields}>
              <label>Nama kanal<input list="sales-channel-list" value={channel.channel} maxLength={40} onChange={event => updateChannel(channelIndex, { channel: event.target.value })} required /><datalist id="sales-channel-list">{knownChannels.map(value => <option key={value} value={value} />)}</datalist></label>
              <label>Jumlah pesanan<input type="number" min="1" max="100000" step="1" value={channel.orders} onChange={event => updateChannel(channelIndex, { orders: event.target.value })} required /></label>
              <label>Potongan &amp; promo usaha (Rp)<input type="number" min="0" step="0.01" value={channel.deductions} onChange={event => updateChannel(channelIndex, { deductions: event.target.value })} required /></label>
            </div>
            <div className={styles.itemsHeader}><strong>Produk terjual</strong><span>Isi omzet produk sebelum potongan kanal</span></div>
            <div className={styles.items}>{channel.items.map((item, itemIndex) => <div className={styles.itemRow} key={`${channelIndex}-${itemIndex}`}>
              <label>Produk<select value={item.calculationId} onChange={event => chooseProduct(channelIndex, itemIndex, event.target.value)} required>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
              <label>Terjual<input type="number" min="1" max="100000" step="1" value={item.quantity} onChange={event => changeQuantity(channelIndex, itemIndex, event.target.value)} required /></label>
              <label>Penjualan kotor (Rp)<input type="number" min="0" step="0.01" value={item.gross} onChange={event => updateLine(channelIndex, itemIndex, { gross: event.target.value })} required /></label>
              <button type="button" className={styles.iconButton} aria-label={`Hapus produk ${itemIndex + 1} dari ${channel.channel}`} disabled={channel.items.length === 1} onClick={() => updateChannel(channelIndex, { items: channel.items.filter((_, index) => index !== itemIndex) })}><Trash2 size={15} /></button>
            </div>)}</div>
            <button type="button" className={styles.textButton} disabled={channel.items.length >= products.length} onClick={() => addLine(channelIndex)}><Plus size={15} /> Tambah produk</button>
          </section>)}
          <button type="button" className={styles.addChannel} disabled={channels.length >= 12} onClick={addChannel}><Plus size={18} /> Tambah kanal penjualan</button>
          {!channels.length && <p className={styles.zeroHint}>Tidak ada penjualan? Simpan tanggal ini sebagai hari tanpa penjualan agar riwayat tetap lengkap.</p>}
          <label className={styles.note}>Catatan hari ini (opsional)<textarea value={note} maxLength={500} rows={2} placeholder="Contoh: Ada promo makan siang atau stok habis lebih awal" onChange={event => setNote(event.target.value)} /></label>
          <div className={styles.saveBar}><span>{totals.orders} pesanan · {totals.units} produk · penerimaan {rupiah(totals.net)}</span><button className="button primary" type="submit" disabled={saving || loading}><Save size={16} />{saving ? "Menyimpan..." : channels.length ? "Simpan rekap" : "Catat tanpa penjualan"}</button></div>
        </>}
      </form>
      <aside className={styles.side}><div className={styles.summary}><span className={styles.eyebrow}>RINGKASAN HARI INI</span><h3>{dateLabel(date)}</h3><div><span>Pesanan</span><strong>{totals.orders}</strong></div><div><span>Produk terjual</span><strong>{totals.units}</strong></div><div><span>Penjualan kotor</span><strong>{rupiah(totals.gross)}</strong></div><div><span>Potongan kanal</span><strong>{rupiah(totals.deductions)}</strong></div><div className={styles.summaryTotal}><span>Penerimaan setelah potongan</span><strong>{rupiah(totals.net)}</strong></div><small>Perkiraan hasil setelah HPP: {rupiah(totals.contribution)}. Belum termasuk biaya usaha di luar HPP.</small></div>
        <div className={styles.history}><div><CalendarDays size={18} /><h3>Riwayat 30 hari</h3></div>{history.length ? history.map(day => <button type="button" className={day.date === date ? styles.selected : ""} key={day.date} onClick={() => setDate(day.date)}><span>{dateLabel(day.date)}<small>{day.orders} pesanan · {day.units} produk</small></span><strong>{rupiah(day.net)}</strong></button>) : <p>Belum ada rekap. Mulai dari tanggal hari ini.</p>}<Link href="/app/sales/analysis">Lihat seluruh analisis <ArrowRight size={14} /></Link></div>
      </aside>
    </div>
  </Shell>;
}

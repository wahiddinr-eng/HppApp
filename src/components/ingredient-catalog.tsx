"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenText, CircleAlert, History, Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { moneyInput, parseMoney, percent, rupiah, unitLabel, type Unit } from "@/lib/hpp";
import type { CatalogIngredient } from "@/lib/ingredient-pricing";
import { PageTop, Shell } from "./shell";
import styles from "./ingredient-catalog.module.css";

type Impact = {
  id: string; name: string; state: "draft" | "final"; draftVersion: number;
  previousCost: string; updatedCost: string; currentPrice: string;
  previousMargin: string; updatedMargin: string; suggestedPrice: string; belowTarget: boolean;
};
type Preview = { ingredient: CatalogIngredient; newPrice: string; impacts: Impact[] };
type HistoryEntry = { version: number; price: string; changedAt: string };
const units: Unit[] = ["g", "kg", "ml", "liter", "buah"];
const displayDate = (date: string) => new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Makassar", dateStyle: "medium", timeStyle: "short" });

export function IngredientCatalog() {
  const [items, setItems] = useState<CatalogIngredient[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("kg");
  const [initialPrice, setInitialPrice] = useState("");
  const [nextPrice, setNextPrice] = useState("");
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const selected = items.find(item => item.id === selectedId);

  async function refresh() {
    const result = await api<{ items: CatalogIngredient[] }>("/api/ingredients");
    setItems(result.items);
    return result.items;
  }
  async function open(item: CatalogIngredient) {
    setSelectedId(item.id); setNextPrice(moneyInput(item.currentPrice)); setPreview(undefined); setHistory([]); setMessage("");
    try {
      const result = await api<{ history: HistoryEntry[] }>(`/api/ingredients/${item.id}`);
      setHistory(result.history);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Riwayat harga gagal dimuat."); }
  }
  useEffect(() => {
    let active = true;
    void api<{ items: CatalogIngredient[] }>("/api/ingredients")
      .then(result => { if (active) setItems(result.items); })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Daftar bahan gagal dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await api<{ ingredient: CatalogIngredient }>("/api/ingredients", {
        method: "POST", body: JSON.stringify({ name, unit, price: parseMoney(initialPrice) }),
      });
      await refresh(); setName(""); setInitialPrice("");
      await open(result.ingredient);
      setMessage("Bahan tersimpan. Hubungkan bahan ini pada resep agar perubahan harga berikutnya memperbarui HPP.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Bahan gagal dibuat."); }
    finally { setBusy(false); }
  }
  async function checkImpact() {
    if (!selected) return;
    setBusy(true); setMessage(""); setPreview(undefined);
    try {
      const result = await api<Preview>(`/api/ingredients/${selected.id}/preview`, {
        method: "POST", body: JSON.stringify({ price: parseMoney(nextPrice), expectedVersion: selected.version }),
      });
      setPreview(result);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Dampak harga gagal dihitung."); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!selected || !preview) return;
    setBusy(true); setMessage("");
    try {
      const result = await api<{ ingredient: CatalogIngredient; updatedRecipes: Impact[] }>(`/api/ingredients/${selected.id}`, {
        method: "PATCH", body: JSON.stringify({
          price: preview.newPrice, expectedVersion: preview.ingredient.version,
          recipeVersions: preview.impacts.map(row => ({ id: row.id, version: row.draftVersion })),
        }),
      });
      await refresh(); await open(result.ingredient);
      setMessage(`Harga tersimpan. ${result.updatedRecipes.length} resep aktif diperbarui; laporan dan rekap lama tetap utuh.`);
    } catch (error) { setPreview(undefined); setMessage(error instanceof Error ? error.message : "Harga gagal diterapkan. Cek dampak lagi."); }
    finally { setBusy(false); }
  }

  return <Shell><PageTop eyebrow="SIAPKAN HARGA" title="Bahan & Riwayat Harga"
    description="Simpan harga bahan sekali, hubungkan ke resep, lalu lihat perubahan HPP sebelum menerapkan harga baru."
    actions={<Link href="/app/calculations" className="button secondary"><BookOpenText size={16} /> Lihat resep</Link>} />
    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={styles.panel}>
          <div className={styles.heading}><div><span className={styles.eyebrow}>DAFTAR BAHAN</span><h2>Bahan usaha Anda</h2></div><span className={styles.count}>{items.length} bahan</span></div>
          {loading ? <p className={styles.muted}>Memuat daftar bahan...</p> : items.length === 0 ? <p className={styles.empty}>Belum ada bahan. Tambahkan bahan pertama di formulir sebelah.</p> :
            <div className={styles.list}>{items.map(item => <button type="button" key={item.id}
              className={`${styles.item} ${selectedId === item.id ? styles.selected : ""}`} onClick={() => void open(item)}>
              <span><strong>{item.name}</strong><small>Terakhir diperbarui {displayDate(item.updatedAt)} WITA</small></span>
              <b>{rupiah(item.currentPrice, 2)} <small>/ {unitLabel(item.unit)}</small></b><ArrowRight size={17} />
            </button>)}</div>}
        </section>
        {selected && <section className={styles.panel}>
          <div className={styles.heading}><div><span className={styles.eyebrow}>PERBARUI HARGA</span><h2>{selected.name}</h2></div><span className={styles.version}>Versi {selected.version}</span></div>
          <p className={styles.muted}>Harga saat ini {rupiah(selected.currentPrice, 2)} per {unitLabel(selected.unit)}. Periksa dampaknya sebelum menyimpan; harga jual menu tidak otomatis dinaikkan.</p>
          <div className={styles.priceForm}><label>Harga baru per {unitLabel(selected.unit)}<span className={styles.inputWrap}><span>Rp</span><input inputMode="decimal" value={nextPrice} onChange={event => { setNextPrice(event.target.value); setPreview(undefined); }} onBlur={() => setNextPrice(moneyInput(nextPrice))} placeholder="18.000" /></span></label>
            <button className="button primary" disabled={busy} onClick={() => void checkImpact()}><RefreshCw size={16} /> Cek dampak</button></div>
          {preview && <div className={styles.preview}>
            <div className={styles.previewTitle}><div><span className={styles.eyebrow}>PRATINJAU · BELUM DISIMPAN</span><h3>{preview.impacts.length} resep aktif terdampak</h3></div><strong>{rupiah(selected.currentPrice, 2)} → {rupiah(preview.newPrice, 2)}</strong></div>
            {preview.impacts.length === 0 ? <p className={styles.muted}>Belum ada resep yang terhubung. Harga bahan tetap bisa disimpan dan dipakai pada resep baru.</p> :
              <div className={styles.impacts}>{preview.impacts.map(row => <article key={row.id} className={styles.impact}>
                <div><strong>{row.name || "Resep tanpa nama"}</strong><small>{row.state === "final" ? "Akan dibuat revisi HPP baru" : "Draft akan diperbarui"}</small></div>
                <div><span>HPP / porsi</span><b>{rupiah(row.previousCost, 2)} → {rupiah(row.updatedCost, 2)}</b></div>
                <div><span>Margin pada harga jual tetap {rupiah(row.currentPrice)}</span><b className={row.belowTarget ? styles.warning : ""}>{percent(row.previousMargin)} → {percent(row.updatedMargin)}{row.belowTarget ? " · di bawah target" : ""}</b></div>
                <div><span>Saran harga baru</span><b>{rupiah(row.suggestedPrice)}</b></div>
              </article>)}</div>}
            <div className={styles.confirm}><p>Konfirmasi akan menyimpan harga dan memperbarui resep aktif. Revisi final dan rekap penjualan sebelumnya tidak ditimpa.</p>
              <button className="button primary" disabled={busy} onClick={() => void apply()}>Simpan harga & perbarui HPP</button></div>
          </div>}
          <div className={styles.history}><h3><History size={17} /> Riwayat harga</h3>{history.length ? history.map(row => <div key={row.version}><span>Versi {row.version} · {displayDate(row.changedAt)} WITA</span><b>{rupiah(row.price, 2)} / {unitLabel(selected.unit)}</b></div>) : <p className={styles.muted}>Memuat riwayat...</p>}</div>
        </section>}
      </div>
      <aside className={styles.side}>
        <form className={styles.panel} onSubmit={event => void create(event)}><span className={styles.eyebrow}>TAMBAH BAHAN</span><h2>Catat bahan baru</h2><p className={styles.muted}>Gunakan satuan yang biasa dipakai saat membeli. Misalnya tepung Rp18.000 per kg.</p>
          <label>Nama bahan<input value={name} onChange={event => setName(event.target.value)} maxLength={100} required placeholder="Contoh: Tepung terigu" /></label>
          <label>Satuan harga<select value={unit} onChange={event => setUnit(event.target.value as Unit)}>{units.map(value => <option key={value} value={value}>{unitLabel(value)}</option>)}</select></label>
          <label>Harga per {unitLabel(unit)}<span className={styles.inputWrap}><span>Rp</span><input value={initialPrice} onChange={event => setInitialPrice(event.target.value)} onBlur={() => setInitialPrice(moneyInput(initialPrice))} inputMode="decimal" required placeholder="18.000" /></span></label>
          <button className="button primary" disabled={busy}><Plus size={16} /> Simpan bahan</button>
        </form>
        <div className={styles.tip}><CircleAlert size={18} /><p>Resep lama belum terhubung otomatis. Buka resep, pilih bahan dari daftar ini pada setiap baris yang sesuai. Harga berikutnya akan mengalir ke semua resep terhubung.</p></div>
      </aside>
    </div>
    {message && <div className={styles.message} role="status">{message}</div>}
  </Shell>;
}

"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { ArrowDownRight, ArrowUpRight, Calculator, RotateCcw } from "lucide-react";
import styles from "./landing.module.css";

const initial = { cost: "120000", quantity: "10", price: "20000" };
const format = (value: Decimal) => "Rp" + value.toNumber().toLocaleString("id-ID", { maximumFractionDigits: 0 });

export function LandingDemo() {
  const [values, setValues] = useState(initial);
  const valid = /^\d{1,12}$/.test(values.cost) && /^\d{1,6}$/.test(values.quantity) && Number(values.quantity) > 0 && /^\d{1,12}$/.test(values.price) && Number(values.price) > 0;
  const cost = valid ? new Decimal(values.cost).div(values.quantity) : null;
  const remainder = cost ? new Decimal(values.price).minus(cost) : null;
  const margin = remainder ? remainder.div(values.price).mul(100) : null;
  const loss = remainder?.lt(0) ?? false;

  return <div className={styles.demoCard}>
    <div className={styles.demoInputs}>
      <div className={styles.demoCardHead}><span><Calculator size={19} /> Hitung satu menu</span><button type="button" onClick={() => setValues(initial)} aria-label="Kembalikan angka contoh"><RotateCcw size={15} /> Reset contoh</button></div>
      <p>Contohnya satu batch rice bowl. Ganti angkanya dengan perkiraan Anda.</p>
      <label htmlFor="demo-cost">Total biaya membuat satu batch<div className={styles.demoInput}><span>Rp</span><input id="demo-cost" type="number" inputMode="numeric" min="0" max="999999999999" step="1" value={values.cost} onChange={event => setValues(current => ({ ...current, cost: event.target.value }))} /></div><small>Gabungkan bahan, kemasan, tenaga kerja, dan biaya produksi lainnya.</small></label>
      <div className={styles.demoInputRow}>
        <label htmlFor="demo-quantity">Hasil jadi<div className={styles.demoInput}><input id="demo-quantity" type="number" inputMode="numeric" min="1" max="999999" step="1" value={values.quantity} onChange={event => setValues(current => ({ ...current, quantity: event.target.value }))} /><span>produk</span></div></label>
        <label htmlFor="demo-price">Harga jual per produk<div className={styles.demoInput}><span>Rp</span><input id="demo-price" type="number" inputMode="numeric" min="1" max="999999999999" step="1" value={values.price} onChange={event => setValues(current => ({ ...current, price: event.target.value }))} /></div></label>
      </div>
    </div>
    <div className={`${styles.demoResult} ${loss ? styles.demoLoss : ""}`} aria-live="polite" aria-atomic="true">
      <span className={styles.smallLabel}>SEKARANG, ANGKANYA LEBIH JELAS</span>
      {cost && remainder && margin ? <>
        <div className={styles.demoCost}><span>Biaya produksi per produk</span><strong>{format(cost)}</strong></div>
        <div className={styles.demoRemainder}><div><span>{loss ? "Kekurangan per produk" : "Sisa setelah biaya produksi"}</span><strong>{format(remainder.abs())}</strong></div>{loss ? <ArrowDownRight size={30} /> : <ArrowUpRight size={30} />}</div>
        <p className={styles.demoStatus}>{loss ? "Harga jual belum menutup biaya produksi." : <>Setara {margin.toNumber().toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari harga jual.</>}</p>
      </> : <div className={styles.demoInvalid}>Isi biaya yang valid, hasil jadi minimal 1, dan harga jual lebih dari Rp0 untuk melihat hasilnya.</div>}
      <p className={styles.demoNote}>Simulasi sederhana, belum memperhitungkan potongan kanal, pajak, dan biaya tetap usaha. Hasil dibulatkan ke rupiah terdekat.</p>
    </div>
  </div>;
}

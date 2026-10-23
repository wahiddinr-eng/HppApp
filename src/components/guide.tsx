"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpenText, ChartColumnIncreasing, CircleCheck, Download, Images, Settings2, ShoppingBag, Store, Target } from "lucide-react";
import { api } from "@/lib/api";
import { PageTop, Shell } from "./shell";
import styles from "./guide.module.css";

type Profile = { user: { name: string; status: string; role: string }; features: string[]; guideCompletedAt: string | null };
type Step = { stage: string; title: string; description: string; href: string; action: string; icon: typeof Settings2 };

export function Guide() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<Profile>("/api/profile").then(setProfile).catch(cause => setError(cause instanceof Error ? cause.message : "Panduan gagal dimuat.")); }, []);
  const canCalculate = profile?.features.includes("hpp_calculator") ?? false;
  const canGallery = profile?.features.includes("prompt_gallery") || profile?.user.role === "admin";
  const steps: Step[] = [
    { stage: "AKUN", title: "Kenalkan usaha Anda", description: "Isi nama usaha dan nama tampilan pada profil.", href: "/app/profile", action: "Isi profil", icon: Settings2 },
    ...(canCalculate ? [
      { stage: "SIAPKAN HARGA", title: "Hitung HPP satu produk", description: "Masukkan biaya bahan, kemasan, tenaga kerja, dan produksi. Finalkan hasil agar produk siap dipakai di fitur lain.", href: "/app/calculations/new", action: "Buat HPP", icon: BookOpenText },
      { stage: "SIAPKAN HARGA", title: "Cek harga setiap kanal", description: "Simulasikan harga GoFood, ShopeeFood, atau kanal lain menggunakan tarif merchant Anda sendiri.", href: "/app/channels", action: "Cek harga", icon: Store },
      { stage: "SIAPKAN HARGA", title: "Tetapkan target untung", description: "Isi biaya tetap, penghasilan yang diinginkan, dan hari berjualan untuk melihat target hasil usaha per hari.", href: "/app/profit-target", action: "Buat target", icon: Target },
    ] : []),
    ...(canGallery ? [
      { stage: "SIAPKAN PROMOSI", title: "Siapkan bahan promosi", description: "Pilih ide visual dari Galeri Prompt dan sesuaikan dengan produk Anda.", href: "/app/prompts", action: "Buka galeri", icon: Images },
    ] : []),
    ...(canCalculate ? [
      { stage: "PANTAU PENJUALAN", title: "Catat penjualan harian", description: "Rekap pesanan, produk terjual, omzet, dan potongan per kanal. Ini bukan kasir per transaksi.", href: "/app/sales", action: "Isi rekap", icon: ShoppingBag },
      { stage: "PANTAU PENJUALAN", title: "Baca hasil dari waktu ke waktu", description: "Pilih rentang tanggal untuk melihat menu terlaris, kanal tersibuk, dan perkiraan hasil setelah HPP.", href: "/app/sales/analysis", action: "Lihat analisis", icon: ChartColumnIncreasing },
    ] : []),
  ];
  const destination = canCalculate ? "/app/calculations" : canGallery ? "/app/prompts" : "/app/access";
  const intro = canCalculate && canGallery
    ? "Siapkan harga, promosikan produk, lalu pantau hasil jualan. Anda tidak harus mengisi semuanya sekaligus."
    : canCalculate
      ? "Hitung HPP, cek harga tiap kanal, lalu catat dan analisis hasil jualan. Anda bisa mulai dari satu produk."
      : canGallery
        ? "Mulai dari profil usaha, lalu jelajahi Galeri Prompt untuk menyiapkan bahan promosi produk Anda."
        : "Periksa status akses pembelian Anda. Fitur yang aktif akan muncul di ruang kerja setelah tervalidasi.";

  async function finish() {
    if (!profile || busy) return;
    setBusy(true); setError("");
    try {
      if (profile.user.role !== "admin" && !profile.guideCompletedAt)
        await api("/api/profile/guide", { method: "POST", body: "{}" });
      router.replace(destination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan status panduan. Coba lagi.");
      setBusy(false);
    }
  }

  return <Shell><PageTop eyebrow="MULAI DI SINI" title="Panduan penggunaan" description="Langkah singkat sesuai fitur akun Anda. Buka kembali kapan saja dari menu bantuan." />
    <div className={styles.guide}>
      <section className={styles.hero}>
        <div><span className={styles.eyebrow}>{profile?.guideCompletedAt ? "PANDUAN KULINERKIT" : "SELAMAT DATANG DI KULINERKIT"}</span>
          <h2>{profile?.guideCompletedAt ? "Lanjutkan dari langkah yang Anda butuhkan." : "Mulai dari langkah pertama."}</h2>
          <p>{intro}</p>
        </div><div className={styles.heroCount}><strong>{profile ? String(steps.length).padStart(2, "0") : "—"}</strong><span>langkah praktis</span></div>
      </section>
      <section className={styles.ebook} aria-labelledby="ebook-title">
        <div className={styles.ebookCover} aria-hidden="true"><span>KULINERKIT</span><strong>Dari biaya resep<br />ke keputusan usaha.</strong><small>PANDUAN LENGKAP</small></div>
        <div className={styles.ebookInfo}><span className={styles.eyebrow}>EBOOK GRATIS UNTUK PENGGUNA</span><h2 id="ebook-title">Pelajari konsepnya, lalu praktikkan langkah demi langkah.</h2><p>Mulai dari arti dan manfaat HPP kuliner, contoh hitungan sederhana, hingga panduan lengkap memakai bahan, kalkulator, harga kanal, target untung, Galeri Prompt, dan analisis penjualan.</p>
          <div className={styles.ebookActions}><Link href="/app/guide/ebook" className="button primary"><BookOpenText size={16} /> Baca ebook</Link><a href="/panduan-kulinerkit.pdf?v=2" download="Panduan-KulinerKit.pdf" className="button secondary"><Download size={16} /> Unduh PDF</a></div>
        </div>
      </section>
      <div className={styles.accessNote}><CircleCheck size={20} /><div><strong>Pasang KulinerKit di iPhone</strong><p>Buka situs ini di Safari, ketuk tombol Bagikan, lalu pilih Tambahkan ke Layar Utama. Buka ikon KulinerKit yang muncul dan masuk dengan akun Anda. Aplikasi tetap memerlukan internet; data usaha tidak disimpan offline di perangkat.</p></div></div>
      {error && <div className="form-message error" role="alert">{error}</div>}
      {!profile && !error && <div className={styles.loading} role="status">Memuat panduan akun...</div>}
      {profile && <>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>URUTAN YANG DISARANKAN</span><h2>Ikuti sesuai kebutuhan usaha</h2></div><p>Mulai dari atas, lanjutkan kapan saja.</p></div>
        <div className={styles.steps}>{steps.map((step, index) => <article className={styles.step} key={step.href}>
          <div className={styles.stepMark}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span><span className={styles.icon}><step.icon size={18} /></span></div>
          <div className={styles.stepText}><span className={styles.stepStage}>{step.stage}</span><h3>{step.title}</h3><p>{step.description}</p></div>
          <Link href={step.href} className={styles.stepAction}>{step.action}<ArrowRight size={15} /></Link>
        </article>)}</div>
        {!canCalculate && !canGallery && <div className={styles.accessNote}><CircleCheck size={20} /><div><strong>Belum ada fitur aktif?</strong><p>Periksa status akses Anda. Fitur akan muncul sesuai pembelian yang sudah tervalidasi.</p><Link href="/app/access">Lihat status akses <ArrowRight size={15} /></Link></div></div>}
        <div className={styles.footer}><div><strong>Siap mulai?</strong><p>Setelah melanjutkan, panduan tetap tersedia di bagian bawah sidebar atau menu Lainnya di ponsel.</p></div><button className="button primary" onClick={() => void finish()} disabled={busy}>{busy ? "Membuka ruang kerja..." : "Mulai menggunakan"}<ArrowRight size={16} /></button></div>
      </>}
    </div>
  </Shell>;
}

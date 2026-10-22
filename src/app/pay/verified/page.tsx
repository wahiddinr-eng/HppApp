import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import styles from "@/components/checkout.module.css";

export const metadata: Metadata = { title: "Pembayaran terverifikasi | KulinerKit", robots: { index: false, follow: false } };

export default function VerifiedPaymentPage() {
  return <div className={styles.page}><header className={styles.header}><Link href="/" className={styles.brand}><span>K</span>KulinerKit</Link><Link href="/" className={styles.back}><ArrowLeft size={16}/> Beranda</Link></header><main className={styles.verifiedMain}>
    <CheckCircle2 size={42} aria-hidden="true"/><span className={styles.eyebrow}>LANGKAH BERIKUTNYA</span><h1>Pembayaran terverifikasi.</h1>
    <p>Jika ini akun KulinerKit pertama Anda, buka email aktivasi untuk membuat password. Jika sudah punya akun, masuk dengan password yang biasa Anda gunakan. Periksa juga folder Spam/Promosi.</p>
    <Link href="/login" className={styles.button}>Masuk setelah akun siap</Link>
  </main></div>;
}

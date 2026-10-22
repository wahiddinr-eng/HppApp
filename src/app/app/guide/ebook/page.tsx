import Link from "next/link";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { PageTop, Shell } from "@/components/shell";
import styles from "./reader.module.css";

export default function EbookPage() {
  return <Shell>
    <PageTop eyebrow="PANDUAN / EBOOK" title="Panduan lengkap KulinerKit" description="Baca di sini atau unduh PDF untuk dipelajari kapan saja." actions={<Link href="/app/guide" className="button secondary"><ArrowLeft size={16} /> Kembali ke panduan</Link>} />
    <div className={styles.reader}>
      <div className={styles.toolbar}><div><strong>Dari biaya resep ke keputusan usaha</strong><span>Edukasi HPP dan tutorial seluruh fitur pelanggan</span></div><div className={styles.actions}><a href="/panduan-kulinerkit.pdf?v=2" target="_blank" rel="noopener noreferrer" className="button secondary"><ExternalLink size={16} /> Buka PDF</a><a href="/panduan-kulinerkit.pdf?v=2" download="Panduan-KulinerKit.pdf" className="button primary"><Download size={16} /> Unduh PDF</a></div></div>
      <iframe className={styles.frame} src="/panduan-kulinerkit.pdf?v=2#toolbar=1" title="Ebook panduan lengkap KulinerKit" />
      <p className={styles.fallback}>Jika pratinjau PDF tidak tampil pada perangkat Anda, pilih <a href="/panduan-kulinerkit.pdf?v=2" target="_blank" rel="noopener noreferrer">Buka PDF</a> atau <a href="/panduan-kulinerkit.pdf?v=2" download="Panduan-KulinerKit.pdf">Unduh PDF</a>.</p>
    </div>
  </Shell>;
}

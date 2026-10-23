import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, BookOpenText, Calculator, Check, CheckCheck, ChefHat, ChevronDown, Coffee, CookingPot, Download, Layers3, Leaf, Lightbulb, MessageCircle, MonitorSmartphone, Package, PieChart, ReceiptText, Sparkles, Store, Target, TrendingUp, UtensilsCrossed } from "lucide-react";
import { KULINERKIT_WHATSAPP_URL } from "@/lib/support";
import { LandingNav } from "./landing-nav";
import { LandingDemo } from "./landing-demo";
import { LandingOffer } from "./landing-offer";
import { LandingPromptComparison } from "./landing-prompt-comparison";
import styles from "./landing.module.css";

const faqs = [
  { question: "Saya baru mau mulai jualan. Apakah sudah bisa pakai?", answer: "Bisa. Mulai dari satu resep dan biaya yang Anda ketahui, lalu hitung HPP serta rencana harga jualnya. Target usaha juga bisa dibuat sebelum ada penjualan. Setelah mulai jualan, isi rekap untuk membangun riwayat analisis Anda." },
  { question: "Apakah KulinerKit juga berfungsi sebagai kasir?", answer: "KulinerKit membantu perencanaan dan evaluasi usaha. Penjualan dicatat sebagai rekap per hari dan kanal, bukan transaksi kasir satu per satu. Anda dapat tetap menggunakan cara menerima pesanan yang sudah nyaman." },
  { question: "Kalau harga bahan naik, apakah harus menghitung dari awal?", answer: "Bahan dari katalog bisa ditautkan ke beberapa resep. Saat harganya berubah, Anda dapat melihat dampaknya pada HPP dan memperbarui resep yang tertaut setelah konfirmasi. Riwayat perhitungan serta HPP pada rekap penjualan lama tetap tersimpan." },
  { question: "Apakah Galeri Prompt langsung menghasilkan gambar?", answer: "Galeri berisi referensi dan prompt promosi yang bisa disalin serta disesuaikan dengan produk Anda. Prompt kemudian digunakan di alat AI pilihan Anda. KulinerKit tidak membuat gambar secara langsung; ketersediaan dan biaya alat AI mengikuti layanan yang Anda gunakan." },
  { question: "Bisa dibuka dari HP? Perlu instal aplikasi?", answer: "Bisa dibuka melalui browser di HP maupun laptop dengan koneksi internet. Anda tidak perlu memasang aplikasi tambahan. Panduan penggunaan tersedia di dalam akun agar Anda bisa mulai dari fitur yang dibutuhkan." },
  { question: "Bagaimana cara mendapatkan akses?", answer: "Buat pesanan melalui tombol Beli akses KulinerKit, lalu ikuti instruksi pembayaran QRIS atau transfer bank. Setelah pembayaran diverifikasi admin, tautan aktivasi akun dikirim ke email pembelian Anda." },
];

function WorkspacePreview() {
  return <div className={styles.heroVisual}>
    <div className={styles.orbit} aria-hidden="true" /><div className={styles.orbitSmall} aria-hidden="true" />
    <div className={styles.workspace}>
      <div className={styles.windowBar}><div aria-hidden="true"><i /><i /><i /></div><span>Ruang usaha Anda</span><span className={styles.previewTag}>ILUSTRASI</span></div>
      <div className={styles.workspaceBody}>
        <div className={styles.previewSidebar} aria-hidden="true"><span>kk</span><Calculator size={18} /><Layers3 size={18} /><Sparkles size={18} /><BarChart3 size={18} /><div /><Leaf size={18} /></div>
        <div className={styles.previewContent}>
          <div className={styles.previewHeading}><div><span>SIAPKAN HARGA</span><h2>Resep enak, hitungan tepat.</h2></div><span className={styles.previewAvatar}>DA</span></div>
          <div className={styles.menuPreview}><div className={styles.menuIcon}><CookingPot size={28} strokeWidth={1.6} /></div><div><strong>Rice Bowl Ayam</strong><span>1 batch · 10 produk</span></div><span className={styles.saved}><Check size={12} /> Terhitung</span></div>
          <div className={styles.previewMetrics}><div><span>HPP per produk</span><strong>Rp12.000</strong><small>Semua biaya produksi</small></div><div><span>Harga jual contoh</span><strong>Rp20.000</strong><small>Sesuai simulasi Anda</small></div></div>
          <div className={styles.costDetail}><div><span>Kenali setiap biaya</span><span>Per produk</span></div><div><span><i />Bahan baku</span><b>Rp8.000</b></div><div><span><i />Kemasan</span><b>Rp2.000</b></div><div><span><i />Tenaga kerja & lainnya</span><b>Rp2.000</b></div><div className={styles.costBar} aria-hidden="true"><span /><span /><span /></div></div>
          <div className={styles.previewFoot}><CheckCheck size={15} /><span>Resep dan riwayat perhitungan tersimpan.</span></div>
        </div>
      </div>
    </div>
    <div className={styles.floatingInsight}><span><TrendingUp size={21} /></span><div><small>BUKAN SEKADAR LAKU</small><strong>Kenali hasil setiap menu.</strong></div></div>
    <div className={styles.heroCaption}><span /> Contoh angka untuk membantu Anda membayangkan alurnya.</div>
  </div>;
}

export function LandingPage() {
  return <div className={styles.page} id="top">
    <a href="#konten" className={styles.skipLink}>Lewati ke konten</a>
    <LandingNav />
    <main id="konten">
      <section className={`${styles.container} ${styles.hero}`} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span className={styles.liveDot} /> BEKAL TUMBUH USAHA KULINER</div>
          <h1 id="hero-title">Hitung dulu<br />biaya menunya.<br />Lalu siapkan<br /><em>promosinya.</em></h1>
          <p>Ketahui biaya produksi dan tentukan harga jual dengan kalkulator HPP. Setelah itu, pilih prompt siap pakai untuk mengubah foto makanan menjadi visual promosi di alat AI pilihan Anda. Semua dimulai dari KulinerKit.</p>
          <div className={styles.heroActions}><a href="#mulai" className={styles.primaryButton}>Mulai lebih terarah <ArrowUpRight size={19} /></a><a href="#simulasi" className={styles.textButton}>Coba hitungan sederhana <ArrowDown size={16} /></a></div>
          <div className={styles.heroChecks}><span><Check size={14} /> Buka di HP & laptop</span><span><Check size={14} /> Tanpa instalasi</span></div>
        </div>
        <WorkspacePreview />
      </section>

      <section className={`${styles.container} ${styles.businesses}`} aria-label="Jenis usaha kuliner"><p>Dari dapur rumahan,<br /><strong>sampai usaha yang terus bertumbuh.</strong></p><div><span><CookingPot size={22} /> Makanan harian</span><span><ChefHat size={22} /> Kue & bakery</span><span><UtensilsCrossed size={22} /> Katering</span><span><Coffee size={22} /> Minuman</span><span><Package size={22} /> Frozen food</span></div></section>

      <section className={`${styles.container} ${styles.problem}`} aria-labelledby="problem-title">
        <div><span className={styles.eyebrow}>YANG SERING TAK TERLIHAT DI BALIK PESANAN</span><h2 id="problem-title">Dapur sibuk.<br />Tapi hasilnya<br /><em>sudah jelas?</em></h2><p>Kadang, yang membuat usaha terasa berat bukan kurang kerja keras. Ada angka dan keputusan kecil yang belum terlihat.</p></div>
        <div className={styles.problemList}>
          <article><span>01</span><div><h3>Harga jual masih ikut-ikutan?</h3><p>Harga tetangga belum tentu cocok dengan bahan, kemasan, dan biaya produksi Anda.</p></div><Calculator size={23} /></article>
          <article><span>02</span><div><h3>Ramai pesanan, sisanya terasa tipis?</h3><p>Potongan aplikasi dan biaya yang terlewat bisa mengubah hasil dari setiap menu.</p></div><ReceiptText size={23} /></article>
          <article><span>03</span><div><h3>Ingin berkembang, mulai dari mana?</h3><p>Tanpa catatan, sulit melihat menu yang diminati dan kanal yang mendatangkan pesanan.</p></div><Lightbulb size={23} /></article>
        </div>
      </section>

      <section className={styles.featureSection} id="fitur" aria-labelledby="features-title">
        <div className={styles.container}>
          <div className={styles.featureHeading}><div><span className={styles.eyebrow}>SATU KULINERKIT. BANYAK BEKAL.</span><h2 id="features-title">Teman di setiap<br /><em>tahap usaha.</em></h2></div><p>Dari menentukan harga pertama sampai mengevaluasi penjualan. Gunakan yang Anda butuhkan, lanjutkan saat usaha siap.</p></div>
          <div className={styles.featureGrid}>
            <article className={`${styles.featureCard} ${styles.pricingFeature}`}>
              <div className={styles.featureTitle}><span>01 / SIAPKAN HARGA</span><Calculator size={22} /></div><h3>Harga yang punya dasar.</h3><p>Hitung HPP lengkap, perbarui harga bahan, lalu simulasikan harga jual langsung maupun aplikasi pesan-antar.</p>
              <div className={styles.channelPreview}><div><span>CONTOH PERBANDINGAN</span><span>HPP Rp12.000</span></div><div><span><Store size={17} /> Jual langsung</span><b>Rp20.000</b></div><div><span><Package size={17} /> Pesan-antar</span><b>Rp25.000</b></div><small>Ilustrasi: sisa Rp8.000/produk, potongan pesan-antar 20%, tanpa biaya tambahan.</small></div>
            </article>
            <article className={`${styles.featureCard} ${styles.promoFeature}`}>
              <div className={styles.featureTitle}><span>02 / SIAPKAN PROMOSI</span><Sparkles size={22} /></div><h3>Ide promosi, selalu punya arah.</h3><p>Jelajahi Galeri Prompt, sesuaikan dengan produk Anda, lalu gunakan di alat AI pilihan untuk menyiapkan visual promosi.</p>
              <LandingPromptComparison />
            </article>
            <article className={`${styles.featureCard} ${styles.targetFeature}`}>
              <div className={styles.featureTitle}><span>03 / TETAPKAN ARAH</span><Target size={22} /></div><h3>Target yang lebih membumi.</h3><p>Isi biaya tetap, penghasilan yang diinginkan, dan hari berjualan. Lihat kebutuhan hasil usaha per hari.</p>
              <div className={styles.targetPreview}><span>CONTOH TARGET USAHA</span><strong>Rp211.539<small>/ hari</small></strong><p>Hasil yang perlu tersisa setelah HPP dan potongan.</p><div><span>Biaya tetap <b>Rp2,5 jt</b></span><span>Target penghasilan <b>Rp3 jt</b></span><span>Hari jualan <b>26 hari</b></span></div></div>
            </article>
            <article className={`${styles.featureCard} ${styles.analysisFeature}`}>
              <div className={styles.featureTitle}><span>04 / PAHAMI HASILNYA</span><BarChart3 size={22} /></div><h3>Tahu apa yang perlu diulang.</h3><p>Rekap penjualan harian dan pilih rentang analisis. Kenali menu terlaris serta kanal yang banyak mendatangkan pesanan.</p>
              <div className={styles.chartPreview}><div><span>MENU TERJUAL</span><span>Contoh 30 hari</span></div><div><span>Rice bowl</span><i><b style={{ width: "88%" }} /></i><strong>120</strong></div><div><span>Es kopi susu</span><i><b style={{ width: "65%" }} /></i><strong>89</strong></div><div><span>Brownies</span><i><b style={{ width: "43%" }} /></i><strong>58</strong></div></div>
            </article>
          </div>
          <div className={styles.featureFooter}><span><BookOpenText size={17} /> Panduan penggunaan</span><span><Download size={17} /> Ekspor HPP ke PDF & Excel</span><span><MessageCircle size={17} /> Bantuan via WhatsApp</span></div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.demoSection}`} id="simulasi" aria-labelledby="demo-title"><div className={styles.centerHeading}><span className={styles.eyebrow}>COBA DULU ANGKANYA</span><h2 id="demo-title">Satu menu. <em>Sudut pandang baru.</em></h2><p>Ubah tiga angka di bawah. Lihat seberapa besar biaya produksi mengambil bagian dari harga jual Anda.</p></div><LandingDemo /><p className={styles.demoAfter}>Di dalam KulinerKit, Anda bisa merinci setiap bahan dan biaya, menyimpan resep, serta menghitung harga per kanal.<a href="#mulai">Kenali toolkit lengkapnya <ArrowRight size={15} /></a></p></section>

      <section className={`${styles.container} ${styles.journey}`} id="cara-kerja" aria-labelledby="journey-title"><div className={styles.journeyHeading}><span className={styles.eyebrow}>TAK HARUS SEMUA SEKALIGUS</span><h2 id="journey-title">Mulai dari satu menu.<br /><em>Lanjutkan selangkah demi selangkah.</em></h2></div><div className={styles.steps}>
        <article><span className={styles.stepNumber}>01</span><h3>Kenali biaya Anda</h3><p>Masukkan bahan dan biaya produksi. Dapatkan HPP untuk menjadi dasar menentukan harga.</p><span className={styles.stepTag}><Calculator size={14} /> Sebelum mulai jualan</span></article>
        <article><span className={styles.stepNumber}>02</span><h3>Siapkan cara menjualnya</h3><p>Cek harga di setiap kanal, tentukan target usaha, lalu cari ide visual di Galeri Prompt.</p><span className={styles.stepTag}><Sparkles size={14} /> Saat menyiapkan penawaran</span></article>
        <article><span className={styles.stepNumber}>03</span><h3>Catat, pahami, perbaiki</h3><p>Isi rekap harian. Gunakan riwayat penjualan untuk menilai menu dan kanal yang layak difokuskan.</p><span className={styles.stepTag}><PieChart size={14} /> Setelah mulai jualan</span></article>
      </div></section>

      <section className={`${styles.container} ${styles.accessSection}`} id="mulai" aria-labelledby="access-title"><div className={styles.accessCopy}><span className={styles.eyebrow}>BEKAL USAHA ANDA BERIKUTNYA</span><h2 id="access-title">Resepnya sudah punya.<br />Sekarang, buat usahanya<br /><em>lebih terarah.</em></h2><p>Kerja keras di dapur layak ditemani keputusan yang lebih jelas. Mulai membangun kebiasaan usaha yang rapi bersama KulinerKit.</p><div className={styles.accessPromise}><MonitorSmartphone size={22} /><span>Satu ruang usaha.<br /><strong>Bisa dibuka dari HP dan laptop Anda.</strong></span></div></div>
        <div className={styles.accessCard}><div className={styles.accessCardHeading}><span className={styles.brandMark} aria-hidden="true">k<span>k</span></span><div><h3>KulinerKit</h3><p>Perangkat usaha kuliner Anda.</p></div></div><div className={styles.accessIncluded}><span>YANG ADA DI DALAM TOOLKIT</span>{["Kalkulator HPP & report PDF / Excel", "Bahan & riwayat perubahan harga", "Simulasi harga per kanal", "Target untung & titik impas", "Galeri Prompt untuk promosi", "Rekap harian & analisis penjualan"].map(item => <div key={item}><Check size={16} /><span>{item}</span></div>)}</div><LandingOffer/><p className={styles.accessNote}>Sekali bayar. Akses diaktifkan setelah pembayaran diverifikasi admin.</p><Link href="/login" className={styles.existingAccount}>Sudah punya akun? <strong>Masuk di sini <ArrowRight size={13} /></strong></Link></div>
      </section>

      <section className={`${styles.container} ${styles.faqSection}`} id="faq" aria-labelledby="faq-title"><div><span className={styles.eyebrow}>SEBELUM ANDA MULAI</span><h2 id="faq-title">Masih ada<br /><em>yang ingin ditanyakan?</em></h2><p>Kami bantu agar langkah pertama terasa lebih mudah.</p><a href={KULINERKIT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={styles.textButton}><MessageCircle size={17} /> Tanya tim KulinerKit <ArrowUpRight size={15} /></a></div><div className={styles.faqList}>{faqs.map(faq => <details key={faq.question}><summary>{faq.question}<ChevronDown size={18} /></summary><p>{faq.answer}</p></details>)}</div></section>
    </main>
    <footer className={styles.footer}><div className={styles.container}><div className={styles.footerTop}><Link href="/" className={styles.brand}><span className={styles.brandMark} aria-hidden="true">k<span>k</span></span><span>Kuliner<span>Kit</span></span></Link><p>Dari resep enak,<br />jadi usaha yang lebih terarah.</p><a href="#top">Kembali ke atas <ArrowUpRight size={17} /></a></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} KulinerKit.</span><span>Dibuat untuk perjalanan usaha kuliner Anda.</span><Link href="/login">Masuk akun <ArrowUpRight size={14} /></Link></div></div></footer>
  </div>;
}

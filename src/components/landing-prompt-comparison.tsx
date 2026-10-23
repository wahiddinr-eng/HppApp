import Image from "next/image";
import styles from "./landing-prompt-comparison.module.css";

export function LandingPromptComparison() {
  return (
    <div className={styles.comparison} role="group" aria-label="Contoh before dan after Galeri Prompt">
      <div className={styles.grid}>
        <figure className={styles.figure}>
          <figcaption className={styles.caption}>
            <span className={styles.label}>Before</span>
            <span>Foto awal</span>
          </figcaption>
          <div className={styles.imageFrame}>
            <Image
              src="/landing/nasi-goreng-before.jpg"
              alt="Foto awal nasi goreng seafood dengan udang, telur, dan kerupuk di piring hitam di atas meja."
              fill
              // The landscape source needs more pixels when cropped to a portrait frame.
              sizes="(max-width: 480px) 200vw, (max-width: 700px) 100vw, (max-width: 1150px) 50vw, 600px"
              className={styles.photo}
            />
          </div>
        </figure>
        <figure className={styles.figure}>
          <figcaption className={styles.caption}>
            <span className={`${styles.label} ${styles.afterLabel}`}>After</span>
            <span>Visual promosi</span>
          </figcaption>
          <div className={styles.imageFrame}>
            <Image
              src="/landing/nasi-goreng-after.jpg"
              alt="Visual promosi Nasi Goreng Seafood R. Resto dengan latar hijau lembut, nama menu, dan harga Rp35.000."
              fill
              sizes="(max-width: 480px) calc(100vw - 94px), (max-width: 700px) calc((100vw - 108px) / 2), (max-width: 1150px) calc((100vw - 216px) / 4), 260px"
              className={styles.photo}
            />
          </div>
        </figure>
      </div>
      <p className={styles.note}>Contoh penggunaan prompt di alat AI pilihan. Hasil dapat berbeda sesuai foto dan alat yang digunakan.</p>
    </div>
  );
}

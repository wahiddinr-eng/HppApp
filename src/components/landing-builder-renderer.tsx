import Link from "next/link";
import type { LandingBlock, LandingPageRecord } from "@/lib/landing-builder";
import { LandingHtmlFrame } from "./landing-html-frame";
import styles from "./landing-builder.module.css";

function Block({ block }: { block: LandingBlock }) {
  if (!block.enabled) return null;
  if (block.type === "CUSTOM_HTML") return <section id={block.anchorId} data-landing-block="custom-html" className={styles.html}><LandingHtmlFrame anchorId={block.anchorId} html={block.html}/></section>;
  if (block.type === "HERO") return <section id={block.anchorId} className={`${styles.section} ${styles.hero}`}><div className={styles.inner}>
    {block.eyebrow && <span className={styles.eyebrow}>{block.eyebrow}</span>}<h1>{block.title}</h1><p>{block.body}</p>
    <div className={styles.actions}><a className={styles.primary} href={block.primaryHref}>{block.primaryLabel}</a>{block.secondaryLabel && block.secondaryHref && <a className={styles.secondary} href={block.secondaryHref}>{block.secondaryLabel}</a>}</div>
  </div></section>;
  if (block.type === "TEXT") return <section id={block.anchorId} className={styles.section}><div className={styles.inner}><h2>{block.heading}</h2><p className={styles.prose}>{block.body}</p></div></section>;
  if (block.type === "IMAGE") return <section id={block.anchorId} className={styles.section}><figure className={styles.inner}>{block.src && <img className={styles.image} src={block.src} alt={block.alt} loading="lazy"/>}{block.caption && <figcaption>{block.caption}</figcaption>}</figure></section>;
  if (block.type === "BENEFITS") return <section id={block.anchorId} className={`${styles.section} ${styles.tinted}`}><div className={styles.inner}><h2>{block.heading}</h2><div className={styles.cards}>{block.items.map((item, index) => <article key={index}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div></div></section>;
  if (block.type === "FAQ") return <section id={block.anchorId} className={styles.section}><div className={styles.inner}><h2>{block.heading}</h2><div className={styles.faq}>{block.items.map((item, index) => <details key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></div></section>;
  return <section id={block.anchorId} className={`${styles.section} ${styles.cta}`}><div className={styles.inner}><h2>{block.heading}</h2>{block.body && <p>{block.body}</p>}<a className={styles.primary} href={block.href}>{block.label}</a></div></section>;
}

export function LandingBuilderRenderer({ page, preview = false }: { page: LandingPageRecord; preview?: boolean }) {
  return <div className={styles.page}>
    {preview && <div className={styles.previewBanner}>Pratinjau admin · {page.status === "published" ? "Halaman terbit" : "Draft"} · <Link href="/admin/landing-pages">Kembali ke editor</Link></div>}
    <main data-landing-renderer className={styles.main}>{page.blocks.map(block => <Block key={block.id} block={block}/>)}</main>
  </div>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Clipboard, Images, Search } from "lucide-react";
import { api } from "@/lib/api";
import { PageTop, Shell } from "./shell";

type PromptCard = { id: string; title: string; group: "FOOD" | "DRINK"; typeName: string; imageUrl: string; promptText: string; usageTips: string };
type Collection = { productId: string; name: string; description: string; cards: PromptCard[] };

export function PromptGallery() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState("");
  const [group, setGroup] = useState<"ALL" | "FOOD" | "DRINK">("ALL");
  const [style, setStyle] = useState("ALL");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [openTips, setOpenTips] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    void api<{ collections: Collection[] }>("/api/prompts").then((result) => {
      if (alive) { setCollections(result.collections); setProductId(result.collections[0]?.productId || ""); setReady(true); }
    }).catch((cause) => { if (alive) { setError(cause instanceof Error ? cause.message : "Gagal memuat galeri."); setReady(true); } });
    return () => { alive = false; };
  }, []);

  const collection = collections.find((item) => item.productId === productId);
  const styles = useMemo(() => [...new Set((collection?.cards || []).filter((card) => group === "ALL" || card.group === group).map((card) => card.typeName))].sort((a, b) => a.localeCompare(b, "id")), [collection, group]);
  const filtered = useMemo(() => (collection?.cards || []).filter((card) =>
    (group === "ALL" || card.group === group) && (style === "ALL" || card.typeName === style)
    && `${card.title} ${card.typeName}`.toLocaleLowerCase("id").includes(search.trim().toLocaleLowerCase("id")),
  ), [collection, group, style, search]);

  async function copy(card: PromptCard) {
    try { await navigator.clipboard.writeText(card.promptText); setCopiedId(card.id); setNotice(`Prompt “${card.title}” disalin.`); }
    catch { setNotice("Gagal menyalin. Periksa izin clipboard browser Anda."); }
  }

  function toggleTips(id: string) {
    setOpenTips((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  return <Shell>
    <PageTop eyebrow="KOLEKSI KREATIF" title="Galeri Prompt" description="Jelajahi contoh visual, temukan gaya yang cocok, dan salin prompt siap pakai." />
    {error && <div className="form-message error" role="alert">{error}</div>}
    {notice && <div className="form-message" role="status">{notice}</div>}
    {!ready ? <div className="panel gallery-empty">Memuat koleksi prompt...</div> : !collection ? <div className="panel gallery-empty"><Images size={28} /><h2>Belum ada koleksi untuk akun ini</h2><p>Galeri akan muncul setelah akses produk Prompt AI aktif pada akun Anda.</p></div> : <>
      {collections.length > 1 && <div className="gallery-products" role="group" aria-label="Koleksi prompt">{collections.map((item) => <button type="button" key={item.productId} className={productId === item.productId ? "selected" : ""} aria-pressed={productId === item.productId} onClick={() => { setProductId(item.productId); setGroup("ALL"); setStyle("ALL"); setSearch(""); }}>{item.name}</button>)}</div>}
      <section className="gallery-hero"><div className="gallery-hero-mark"><Images size={24} /></div><span>KOLEKSI EKSKLUSIF</span><h2>{collection.name}</h2><p>{collection.description || "Pilih contoh, lalu salin prompt untuk membuat visual produk Anda."}</p><small>{collection.cards.length} prompt tersedia</small></section>
      <div className="gallery-filters panel"><div className="gallery-filter-row"><div className="gallery-chips" role="group" aria-label="Kategori prompt">{([ ["ALL", "Semua"], ["FOOD", "Makanan"], ["DRINK", "Minuman"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={group === value} className={group === value ? "selected" : ""} onClick={() => { setGroup(value); setStyle("ALL"); }}>{label}</button>)}</div><label className="search-box gallery-search"><Search size={16} /><span className="sr-only">Cari judul atau style prompt</span><input placeholder="Cari judul atau style..." value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        <div className="gallery-style"><strong>Style</strong><div className="gallery-chips" role="group" aria-label="Style prompt"><button type="button" aria-pressed={style === "ALL"} className={style === "ALL" ? "selected" : ""} onClick={() => setStyle("ALL")}>Semua style</button>{styles.map((item) => <button type="button" key={item} aria-pressed={style === item} className={style === item ? "selected" : ""} onClick={() => setStyle(item)}>{item}</button>)}</div></div>
        <small aria-live="polite">{filtered.length} dari {collection.cards.length} prompt ditampilkan</small>
      </div>
      {filtered.length ? <div className="gallery-grid">{filtered.map((card) => <article key={card.id} className="panel gallery-card"><img src={card.imageUrl} alt={`Contoh hasil ${card.title}`} loading="lazy" /><div className="gallery-card-body"><span>{card.group === "FOOD" ? "MAKANAN" : "MINUMAN"} · {card.typeName}</span><h3>{card.title}</h3>{card.usageTips && <div className="gallery-tips"><button type="button" aria-expanded={openTips.has(card.id)} aria-controls={`tips-${card.id}`} onClick={() => toggleTips(card.id)}>Tips penggunaan <ChevronDown size={16} /></button><p id={`tips-${card.id}`} hidden={!openTips.has(card.id)}>{card.usageTips}</p></div>}<button className="button primary full" type="button" onClick={() => void copy(card)}>{copiedId === card.id ? <Check size={16} /> : <Clipboard size={16} />}{copiedId === card.id ? "Tersalin" : "Salin prompt"}</button></div></article>)}</div> : <div className="panel gallery-empty"><p>Tidak ada prompt yang cocok. Coba kategori, style, atau kata kunci lain.</p></div>}
    </>}
  </Shell>;
}

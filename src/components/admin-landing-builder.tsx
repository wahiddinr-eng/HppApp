"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Monitor, Plus, Save, Smartphone, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { landingPageInputSchema, newLandingBlock, type LandingBlock, type LandingPageInput, type LandingPageRecord } from "@/lib/landing-builder";
import { PageTop } from "./shell";
import { LandingBuilderRenderer } from "./landing-builder-renderer";
import styles from "./admin-landing-builder.module.css";

type Summary = Pick<LandingPageRecord, "id" | "slug" | "title" | "status" | "version" | "updatedAt">;
type Draft = LandingPageInput & { id?: string; version?: number };
const types: Array<{ type: LandingBlock["type"]; label: string }> = [
  { type: "HERO", label: "Hero" }, { type: "TEXT", label: "Teks" }, { type: "IMAGE", label: "Gambar" },
  { type: "BENEFITS", label: "Manfaat" }, { type: "FAQ", label: "FAQ" }, { type: "CTA", label: "Tombol CTA" },
  { type: "CUSTOM_HTML", label: "Custom HTML" },
];
const label = (type: LandingBlock["type"]) => types.find(item => item.type === type)?.label || type;
function starter(): Draft { return { slug: "", title: "", seoDescription: "", status: "draft", metaViewContentEnabled: false, blocks: [newLandingBlock("HERO"), { ...newLandingBlock("BENEFITS"), anchorId: "manfaat" }, newLandingBlock("CTA")] }; }

function LivePreview({ draft }: { draft: Draft }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [stageWidth, setStageWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(800);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stage = stageRef.current;
    const content = contentRef.current;
    if (!stage || !content) return;
    const measure = () => { setStageWidth(stage.clientWidth); setContentHeight(content.scrollHeight); };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, []);
  const width = device === "desktop" ? 1024 : 390;
  const scale = stageWidth ? Math.min(1, Math.max(0.1, (stageWidth - 32) / width)) : 1;
  const page: LandingPageRecord = { ...draft, id: draft.id || "live-preview", version: draft.version || 0,
    createdAt: "", updatedAt: "", publishedAt: null };
  return <aside className={styles.previewPane} aria-label="Pratinjau langsung">
    <div className={styles.previewHeader}><div><span>PRATINJAU LANGSUNG</span><h2>{draft.title || "Landing page baru"}</h2><p>Perubahan tampil sebelum disimpan. ViewContent bawaan tidak dikirim dari pratinjau.</p></div>
      <div className={styles.deviceSwitch} role="group" aria-label="Tampilan pratinjau">
        <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={15}/> Desktop</button>
        <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}><Smartphone size={15}/> Mobile</button>
      </div>
    </div>
    <div ref={stageRef} className={styles.previewStage} data-preview-device={device}>
      <div className={styles.previewSpacer} style={{ width: width * scale, height: Math.max(contentHeight, 680) * scale }}>
        <div ref={contentRef} className={styles.previewContent} style={{ width, transform: `scale(${scale})` }}>
          <LandingBuilderRenderer page={page}/>
        </div>
      </div>
    </div>
  </aside>;
}

function BlockFields({ block, update }: { block: LandingBlock; update: (next: LandingBlock) => void }) {
  const field = (name: string, value: string, change: (value: string) => void, area = false, help?: string) =>
    <label className={styles.field}>{name}{area ? <textarea rows={name === "HTML, CSS, dan JavaScript" ? 15 : 4} value={value} onChange={event => change(event.target.value)}/> : <input value={value} onChange={event => change(event.target.value)}/>}{help && <small>{help}</small>}</label>;
  if (block.type === "HERO") return <div className={styles.fields}>
    {field("Eyebrow", block.eyebrow, value => update({ ...block, eyebrow: value }))}
    {field("Judul utama", block.title, value => update({ ...block, title: value }))}
    {field("Penjelasan", block.body, value => update({ ...block, body: value }), true)}
    {field("Teks tombol utama", block.primaryLabel, value => update({ ...block, primaryLabel: value }))}
    {field("Tautan tombol utama", block.primaryHref, value => update({ ...block, primaryHref: value }), false, "Gunakan /checkout atau #anchor-blok.")}
    {field("Teks tombol kedua", block.secondaryLabel, value => update({ ...block, secondaryLabel: value }))}
    {field("Tautan tombol kedua", block.secondaryHref, value => update({ ...block, secondaryHref: value }))}
  </div>;
  if (block.type === "TEXT") return <div className={styles.fields}>{field("Judul", block.heading, value => update({ ...block, heading: value }))}{field("Isi", block.body, value => update({ ...block, body: value }), true)}</div>;
  if (block.type === "IMAGE") return <div className={styles.fields}>{field("URL HTTPS atau path gambar", block.src, value => update({ ...block, src: value }), false, "Contoh: https://.../gambar.webp atau /landing/gambar.jpg")}{field("Teks alternatif", block.alt, value => update({ ...block, alt: value }))}{field("Keterangan", block.caption, value => update({ ...block, caption: value }))}</div>;
  if (block.type === "CTA") return <div className={styles.fields}>{field("Judul", block.heading, value => update({ ...block, heading: value }))}{field("Penjelasan", block.body, value => update({ ...block, body: value }), true)}{field("Teks tombol", block.label, value => update({ ...block, label: value }))}{field("Tautan tombol", block.href, value => update({ ...block, href: value }), false, "Gunakan /checkout atau #anchor-blok.")}</div>;
  if (block.type === "CUSTOM_HTML") return <div className={styles.fields}>{field("HTML, CSS, dan JavaScript", block.html, value => update({ ...block, html: value }), true, `${block.html.length}/300.000 karakter. HTML tampil selebar halaman; tinggi menyesuaikan isi.`)}<p className={styles.htmlNote}>Untuk tombol menuju blok lain, gunakan <code>href="#anchor-tujuan"</code>. Script berjalan dalam iframe terpisah. Aset dan form eksternal gunakan HTTPS; tempel hanya kode yang Anda percaya.</p></div>;
  if (block.type === "BENEFITS") return <div className={styles.fields}>{field("Judul", block.heading, value => update({ ...block, heading: value }))}
    {block.items.map((item, index) => <div className={styles.item} key={index}>{field(`Manfaat ${index + 1}`, item.title, value => update({ ...block, items: block.items.map((old, i) => i === index ? { ...old, title: value } : old) }))}{field("Penjelasan", item.body, value => update({ ...block, items: block.items.map((old, i) => i === index ? { ...old, body: value } : old) }), true)}<button type="button" onClick={() => update({ ...block, items: block.items.filter((_, i) => i !== index) })} disabled={block.items.length <= 1}>Hapus manfaat</button></div>)}
    <button type="button" className={styles.smallButton} disabled={block.items.length >= 12} onClick={() => update({ ...block, items: [...block.items, { title: "Manfaat baru", body: "Jelaskan manfaat ini." }] })}><Plus size={15}/> Tambah manfaat</button>
  </div>;
  return <div className={styles.fields}>{field("Judul", block.heading, value => update({ ...block, heading: value }))}
    {block.items.map((item, index) => <div className={styles.item} key={index}>{field(`Pertanyaan ${index + 1}`, item.question, value => update({ ...block, items: block.items.map((old, i) => i === index ? { ...old, question: value } : old) }))}{field("Jawaban", item.answer, value => update({ ...block, items: block.items.map((old, i) => i === index ? { ...old, answer: value } : old) }), true)}<button type="button" onClick={() => update({ ...block, items: block.items.filter((_, i) => i !== index) })} disabled={block.items.length <= 1}>Hapus pertanyaan</button></div>)}
    <button type="button" className={styles.smallButton} disabled={block.items.length >= 20} onClick={() => update({ ...block, items: [...block.items, { question: "Pertanyaan baru?", answer: "Tulis jawaban yang jelas." }] })}><Plus size={15}/> Tambah pertanyaan</button>
  </div>;
}

export function AdminLandingBuilder() {
  const [pages, setPages] = useState<Summary[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newType, setNewType] = useState<LandingBlock["type"]>("TEXT");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => { try { const result = await api<{ pages: Summary[] }>("/api/admin/landing-pages"); setPages(result.pages); } catch (cause) { setError(cause instanceof Error ? cause.message : "Daftar landing page gagal dimuat."); } }, []);
  useEffect(() => { void load(); }, [load]);
  function change(next: Draft) { setDraft(next); setDirty(true); setNotice(""); }
  function canSwitch() { return !dirty || window.confirm("Perubahan yang belum disimpan akan hilang. Lanjutkan?"); }
  async function open(id: string) {
    if (!canSwitch()) return;
    setBusy(true); setError(""); setNotice("");
    try { const result = await api<{ page: LandingPageRecord }>(`/api/admin/landing-pages?id=${encodeURIComponent(id)}`); setDraft(result.page); setDirty(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Halaman gagal dimuat."); }
    finally { setBusy(false); }
  }
  function create() { if (canSwitch()) { setDraft(starter()); setDirty(false); setError(""); setNotice(""); } }
  function updateBlock(index: number, next: LandingBlock) { if (!draft) return; change({ ...draft, blocks: draft.blocks.map((block, i) => i === index ? next : block) }); }
  function move(index: number, offset: number) { if (!draft) return; const blocks = [...draft.blocks]; const [block] = blocks.splice(index, 1); blocks.splice(index + offset, 0, block); change({ ...draft, blocks }); }
  function addBlock() { if (!draft) return; const taken = new Set(draft.blocks.map(block => block.anchorId)); let sequence = 1; while (taken.has(`${newType.toLowerCase().replace("_", "-")}-${sequence}`)) sequence++; change({ ...draft, blocks: [...draft.blocks, newLandingBlock(newType, sequence)] }); }
  async function save(status: "draft" | "published") {
    if (!draft) return;
    const input = { slug: draft.slug, title: draft.title, seoDescription: draft.seoDescription, status, metaViewContentEnabled: draft.metaViewContentEnabled, blocks: draft.blocks };
    const parsed = landingPageInputSchema.safeParse(input);
    if (!parsed.success) { const issue = parsed.error.issues[0]; setError(`${issue.path.join(" → ")}: ${issue.message}`); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ page: LandingPageRecord }>("/api/admin/landing-pages", { method: draft.id ? "PUT" : "POST", body: JSON.stringify(draft.id ? { ...parsed.data, id: draft.id, expectedVersion: draft.version } : parsed.data) });
      setDraft(result.page); setDirty(false); setNotice(status === "published" ? "Landing page diterbitkan." : "Draft tersimpan."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Halaman gagal disimpan."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!draft?.id || !draft.version || !window.confirm(`Hapus landing page ${draft.slug}? Tautan publiknya akan berhenti bekerja.`)) return;
    setBusy(true); setError("");
    try { await api("/api/admin/landing-pages", { method: "DELETE", body: JSON.stringify({ id: draft.id, expectedVersion: draft.version }) }); setDraft(null); setDirty(false); setNotice("Landing page dihapus."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Halaman gagal dihapus."); }
    finally { setBusy(false); }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void save(draft?.status || "draft"); };
  return <><PageTop eyebrow="KONTEN PEMASARAN" title="Landing page builder" description="Susun blok untuk halaman kampanye KulinerKit. Halaman baru dimulai sebagai draft dan hanya tampil publik setelah diterbitkan."/>
    {error && <p className="form-message error" role="alert">{error}</p>}{notice && <p className="form-message" role="status">{notice}</p>}
    <div className={styles.layout}><div className={styles.builderPane}><aside className={styles.list}><div className={styles.listHeader}><strong>Halaman</strong><button type="button" onClick={create} disabled={busy}><Plus size={16}/> Baru</button></div>
      {pages.length ? pages.map(page => <button key={page.id} type="button" className={`${styles.pageItem}${draft?.id === page.id ? ` ${styles.selected}` : ""}`} onClick={() => void open(page.id)} disabled={busy}><strong>{page.title}</strong><span>/landing/{page.slug}</span><small>{page.status === "published" ? "Terbit" : "Draft"}</small></button>) : <p className={styles.empty}>Belum ada halaman kampanye. Klik Baru untuk mulai.</p>}
    </aside>
    <div className={styles.editor}>{draft ? <form onSubmit={submit}><div className={styles.editorHeader}><div><span>{draft.id ? "EDIT HALAMAN" : "HALAMAN BARU"}</span><h2>{draft.title || "Landing page baru"}</h2></div><div className={styles.topActions}>{draft.id && <a href={`/landing/preview/${draft.id}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Pratinjau tersimpan</a>}{draft.id && draft.status === "published" && <a href={`/landing/${draft.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Publik</a>}</div></div>
      <div className={styles.settings}><label className={styles.field}>Judul halaman<input value={draft.title} onChange={event => change({ ...draft, title: event.target.value })} maxLength={180} required/></label><label className={styles.field}>Slug URL<input value={draft.slug} onChange={event => change({ ...draft, slug: event.target.value.toLowerCase() })} placeholder="promo-kulinerkit" required/><small>Alamat publik: /landing/{draft.slug || "slug-anda"}</small></label><label className={styles.field}>Deskripsi SEO<textarea value={draft.seoDescription} onChange={event => change({ ...draft, seoDescription: event.target.value })} maxLength={170} rows={3}/></label><label className={`${styles.toggle} ${styles.trackingToggle}`}><input type="checkbox" checked={draft.metaViewContentEnabled} onChange={event => change({ ...draft, metaViewContentEnabled: event.target.checked })}/><span>Aktifkan ViewContent untuk landing page ini<small>Event dikirim pada halaman publik setelah pengaturan Meta KulinerKit aktif.</small></span></label></div>
      <div className={styles.blockHeading}><div><span>BLOK HALAMAN</span><h2>{draft.blocks.length} blok</h2></div><div><select value={newType} onChange={event => setNewType(event.target.value as LandingBlock["type"])}>{types.map(item => <option key={item.type} value={item.type}>{item.label}</option>)}</select><button type="button" onClick={addBlock} disabled={draft.blocks.length >= 60}><Plus size={16}/> Tambah blok</button></div></div>
      <div className={styles.blocks}>{draft.blocks.map((block, index) => <section className={styles.block} key={block.id}><div className={styles.blockTop}><div><span className={styles.blockNumber}>{String(index + 1).padStart(2, "0")}</span><strong>{label(block.type)}</strong></div><div className={styles.blockTools}><button type="button" title="Naikkan blok" aria-label={`Naikkan blok ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button type="button" title="Turunkan blok" aria-label={`Turunkan blok ${index + 1}`} disabled={index === draft.blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></button><button type="button" title="Hapus blok" aria-label={`Hapus blok ${index + 1}`} onClick={() => change({ ...draft, blocks: draft.blocks.filter((_, i) => i !== index) })}><Trash2 size={16}/></button></div></div><div className={styles.blockMeta}><label className={styles.field}>Anchor ID<input value={block.anchorId} onChange={event => updateBlock(index, { ...block, anchorId: event.target.value } as LandingBlock)}/></label><label className={styles.toggle}><input type="checkbox" checked={block.enabled} onChange={event => updateBlock(index, { ...block, enabled: event.target.checked } as LandingBlock)}/> Blok aktif</label></div><BlockFields block={block} update={next => updateBlock(index, next)}/></section>)}</div>
      <div className={styles.saveBar}><span>{dirty ? "Ada perubahan yang belum disimpan." : draft.id ? `Versi ${draft.version} · ${draft.status === "published" ? "Terbit" : "Draft"}` : "Belum disimpan"}</span><div><button type="button" className={styles.draftButton} disabled={busy} onClick={() => void save("draft")}><Save size={16}/> Simpan draft</button><button type="button" className={styles.publishButton} disabled={busy} onClick={() => void save("published")}><ExternalLink size={16}/> Terbitkan</button>{draft.id && <button type="button" className={styles.deleteButton} disabled={busy} onClick={() => void remove()}><Trash2 size={16}/> Hapus</button>}</div></div>
    </form> : <div className={styles.welcome}><h2>Susun halaman kampanye Anda</h2><p>Gunakan blok Hero, teks, gambar, manfaat, FAQ, tombol beli, atau HTML khusus. Blok HTML dapat berisi CSS dan JavaScript yang tampil selebar halaman.</p><button type="button" onClick={create}><Plus size={17}/> Buat landing page</button></div>}</div></div>
    {draft ? <LivePreview draft={draft}/> : <div className={styles.previewEmpty}>Pratinjau muncul saat Anda membuat atau memilih landing page.</div>}</div>
  </>;
}

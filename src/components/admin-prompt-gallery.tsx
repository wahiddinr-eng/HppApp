"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Eye, ImagePlus, Images, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import { PageTop } from "./shell";
import styles from "./admin-prompt-gallery.module.css";

type Collection = { productId: string; name: string; description: string };
type Card = { id: string; productId: string; title: string; group: "FOOD" | "DRINK"; typeName: string;
  promptText: string; usageTips: string; sortOrder: number; active: boolean; imageUrl: string };
type Data = { collections: Collection[]; selectedProductId: string; cards: Card[]; eligibleProductIds: string[] };
type Draft = Omit<Card, "id">;
const emptyDraft = (productId: string): Draft => ({ productId, title: "", group: "FOOD", typeName: "",
  promptText: "", usageTips: "", sortOrder: 0, active: true, imageUrl: "" });

export function AdminPromptGallery() {
  const [data, setData] = useState<Data>();
  const [productId, setProductId] = useState("");
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(""));
  const [editingId, setEditingId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [collectionDraft, setCollectionDraft] = useState({ productId: "", name: "", description: "" });
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (selected?: string) => {
    setLoading(true);
    try {
      const result = await api<Data>(`/api/admin/prompt-gallery${selected ? `?productId=${encodeURIComponent(selected)}` : ""}`);
      setData(result); setProductId(result.selectedProductId);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Gagal memuat kartu prompt."));
  }, [load]);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!editorOpen) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, [editorOpen]);

  function reset(selected = productId) {
    setEditingId(""); setDraft(emptyDraft(selected)); setFile(undefined); setEditorError("");
    if (fileInput.current) fileInput.current.value = "";
  }
  async function chooseProduct(id: string) {
    setError(""); setNotice(""); setSearch(""); setCategory("ALL"); setStatus("ALL");
    try { await load(id); } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat koleksi."); }
  }
  function openEditor(card?: Card) {
    reset();
    if (card) { setEditingId(card.id); setDraft({ ...card }); }
    setEditorOpen(true);
  }
  function closeEditor() { if (!busy) setEditorOpen(false); }
  function selectFile(selected?: File) {
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 8 * 1024 * 1024) {
      setEditorError("Gunakan gambar JPG, PNG, atau WebP berukuran maksimal 8 MB.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setEditorError(""); setFile(selected);
  }

  async function saveCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    try {
      await api("/api/admin/prompt-gallery", { method: "POST", body: JSON.stringify(collectionDraft) });
      setShowCollectionForm(false);
      setCollectionDraft({ productId: "", name: "", description: "" });
      setSearch(""); setCategory("ALL"); setStatus("ALL");
      setNotice("Koleksi berhasil dibuat. Anda dapat menambahkan kartu prompt sekarang.");
      await load(collectionDraft.productId.trim());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal membuat atau memuat koleksi."); }
    finally { setBusy(false); }
  }

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(""); setEditorError("");
    if (!editingId && !file) { setEditorError("Pilih gambar contoh untuk kartu baru."); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("productId", draft.productId); form.set("title", draft.title); form.set("group", draft.group);
      form.set("typeName", draft.typeName); form.set("promptText", draft.promptText);
      form.set("usageTips", draft.usageTips); form.set("sortOrder", String(draft.sortOrder));
      form.set("active", String(draft.active)); if (file) form.set("image", file);
      const url = editingId ? `/api/admin/prompt-gallery/cards/${encodeURIComponent(editingId)}` : "/api/admin/prompt-gallery/cards";
      const response = await fetch(url, { method: editingId ? "PATCH" : "POST", body: form, credentials: "same-origin", cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Kartu prompt gagal disimpan.");
    } catch (cause) {
      setEditorError(cause instanceof Error ? cause.message : "Kartu prompt gagal disimpan.");
      setBusy(false); return;
    }
    setEditorOpen(false); reset(); setError(""); setNotice("Kartu prompt tersimpan.");
    try { await load(productId); } catch { setError("Kartu tersimpan, tetapi daftar gagal dimuat ulang. Silakan muat ulang halaman."); }
    finally { setBusy(false); }
  }

  async function remove(card: Card) {
    if (!window.confirm(`Hapus kartu prompt “${card.title}”? Tindakan ini menghapus teks dan kartu dari galeri.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/api/admin/prompt-gallery/cards/${encodeURIComponent(card.id)}`, { method: "DELETE" });
      setNotice("Kartu prompt dihapus."); await load(productId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal menghapus atau memuat ulang kartu."); }
    finally { setBusy(false); }
  }

  const current = data?.collections.find((item) => item.productId === productId);
  const activeCount = data?.cards.filter((card) => card.active).length ?? 0;
  const cards = (data?.cards ?? []).filter((card) =>
    (category === "ALL" || card.group === category) &&
    (status === "ALL" || (status === "ACTIVE" ? card.active : !card.active)) &&
    `${card.title} ${card.typeName}`.toLocaleLowerCase("id").includes(search.trim().toLocaleLowerCase("id")));

  return <>
    <PageTop eyebrow="ADMIN / KONTEN" title="Kartu Prompt" description="Kelola inspirasi visual dan prompt untuk customer Anda."
      actions={<Link href="/app/prompts" className="button secondary">Lihat galeri customer <ArrowUpRight size={16} /></Link>} />
    <div className={styles.workspace}>
      {error && <div className="form-message error" role="alert">{error}</div>}
      {notice && <div className="form-message" role="status">{notice}</div>}
      <section className={styles.collection}>
        <div className={styles.collectionIcon}><Images size={24} /></div>
        <div className={styles.collectionPicker}>
          <label htmlFor="prompt-product">KOLEKSI PRODUK</label>
          <select id="prompt-product" value={productId} onChange={(event) => void chooseProduct(event.target.value)} disabled={busy || loading || !data?.collections.length}>
            {data?.collections.length ? data.collections.map((item) => <option key={item.productId} value={item.productId}>{item.name}</option>) : <option value="">Belum ada koleksi</option>}
          </select>
          <p>Gambar dan prompt dalam koleksi ini tersedia untuk pembeli produk terkait.</p>
        </div>
        <button type="button" className={`button secondary ${styles.collectionButton}`} aria-expanded={showCollectionForm} onClick={() => setShowCollectionForm(!showCollectionForm)} disabled={busy}>
          {showCollectionForm ? <X size={15} /> : <Plus size={15} />}{showCollectionForm ? "Tutup" : "Koleksi baru"}
        </button>
      </section>
      {current && !data?.eligibleProductIds.includes(current.productId) && <div className="channel-note">Koleksi ini belum tercantum dalam PROMPT_GALLERY_PRODUCT_IDS. Admin dapat mengelola kartu, tetapi pembelian baru belum otomatis memberi akses galeri.</div>}
      {showCollectionForm && <form className={styles.newCollection} onSubmit={(event) => void saveCollection(event)}>
        <div><h2>Buat koleksi baru</h2><p>Gunakan ID produk yang sama dengan katalog LRMobileID agar akses pembeli terhubung.</p></div>
        <div className={styles.two}>
          <label className={styles.field}>ID produk<input required maxLength={128} pattern="[a-zA-Z0-9_-]+" value={collectionDraft.productId} onChange={(event) => setCollectionDraft({ ...collectionDraft, productId: event.target.value })} placeholder="prd_..." /></label>
          <label className={styles.field}>Nama koleksi<input required minLength={2} maxLength={200} value={collectionDraft.name} onChange={(event) => setCollectionDraft({ ...collectionDraft, name: event.target.value })} placeholder="Contoh: Foto produk makanan" /></label>
        </div>
        <label className={styles.field}>Deskripsi<textarea rows={2} maxLength={10000} value={collectionDraft.description} onChange={(event) => setCollectionDraft({ ...collectionDraft, description: event.target.value })} /></label>
        <div><button className="button primary" disabled={busy} type="submit">{busy ? "Menyimpan..." : "Buat koleksi"}</button></div>
      </form>}
      {current && <>
        <div className={styles.libraryHeader}>
          <div><h2>Semua kartu <span>{data?.cards.length ?? 0}</span></h2><p><span className={styles.liveDot} />{activeCount} ditampilkan <span className={styles.separator}>/</span>{(data?.cards.length ?? 0) - activeCount} draft</p></div>
          <button className="button primary" disabled={busy || loading} onClick={() => openEditor()}><Plus size={17} />Tambah kartu</button>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.search}><Search size={18} /><input type="search" aria-label="Cari kartu prompt" placeholder="Cari judul atau style prompt..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <div className={styles.filters}>
            <select aria-label="Filter kategori" value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">Semua kategori</option><option value="FOOD">Makanan</option><option value="DRINK">Minuman</option></select>
            <select aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Semua status</option><option value="ACTIVE">Ditampilkan</option><option value="DRAFT">Draft</option></select>
          </div>
        </div>
      </>}
      {loading ? <div className={styles.empty} role="status"><Images size={28} /><h3>Memuat kartu prompt...</h3></div>
        : !current ? <div className={styles.empty}><Images size={32} /><h3>Mulai dengan koleksi pertama</h3><p>Buat koleksi produk, lalu tambahkan gambar dan prompt Anda.</p><button className="button primary" onClick={() => setShowCollectionForm(true)}><Plus size={16} />Buat koleksi</button></div>
        : cards.length ? <>
          <div className={styles.resultCount} aria-live="polite">Menampilkan {cards.length} dari {data?.cards.length} kartu</div>
          <div className={styles.grid}>{cards.map((card) => <article className={styles.card} key={card.id}>
            <div className={styles.cardImage}>
              <img src={card.imageUrl} alt={card.title} loading="lazy" />
              <span className={`${styles.badge} ${card.active ? styles.active : styles.draft}`}>{card.active ? <Eye size={12} /> : <Pencil size={12} />}{card.active ? "Ditampilkan" : "Draft"}</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardMeta}><span>{card.group === "FOOD" ? "Makanan" : "Minuman"}</span><span title={card.typeName}>{card.typeName}</span></div>
              <h3 title={card.title}>{card.title}</h3>
              <p className={styles.excerpt}>{card.promptText}</p>
              <div className={styles.cardFooter}><span>Urutan {card.sortOrder}</span><div>
                <button type="button" className={styles.editButton} disabled={busy} onClick={() => openEditor(card)} aria-label={`Edit ${card.title}`}><Pencil size={14} />Edit</button>
                <button type="button" className={styles.deleteButton} disabled={busy} onClick={() => void remove(card)} aria-label={`Hapus ${card.title}`} title="Hapus kartu"><Trash2 size={15} /></button>
              </div></div>
            </div>
          </article>)}</div>
        </> : <div className={styles.empty}><ImagePlus size={32} /><h3>{data?.cards.length ? "Tidak ada kartu yang cocok" : "Kartu pertama Anda dimulai di sini"}</h3><p>{data?.cards.length ? "Coba kata kunci lain atau ubah filter pencarian." : "Tambahkan gambar contoh dan prompt untuk melengkapi koleksi ini."}</p>
          {data?.cards.length ? <button className="button secondary" onClick={() => { setSearch(""); setCategory("ALL"); setStatus("ALL"); }}>Reset filter</button> : <button className="button primary" onClick={() => openEditor()}><Plus size={16} />Tambah kartu</button>}
        </div>}
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="prompt-editor-title" onCancel={(event) => { event.preventDefault(); closeEditor(); }} onClose={() => setEditorOpen(false)}>
      {editorOpen && <form onSubmit={(event) => void saveCard(event)} className={styles.editorForm}>
        <header className={styles.dialogHeader}><div><span>EDITOR KARTU PROMPT</span><h2 id="prompt-editor-title">{editingId ? "Edit kartu prompt" : "Tambah kartu baru"}</h2></div><button type="button" className={styles.closeButton} aria-label="Tutup editor" disabled={busy} onClick={closeEditor}><X size={21} /></button></header>
        <div className={styles.editorBody}>
          {editorError && <div className={`form-message error ${styles.editorError}`} role="alert">{editorError}</div>}
          <fieldset disabled={busy} className={styles.editorFields}>
            <div className={styles.visualColumn}>
              <div className={styles.sectionLabel}>GAMBAR CONTOH</div>
              <div className={styles.upload}>
                {(preview || draft.imageUrl) ? <img src={preview || draft.imageUrl} alt="Pratinjau gambar prompt" /> : <div className={styles.uploadPlaceholder}><ImagePlus size={36} /><strong>Berikan inspirasi visual</strong><span>Gambar contoh hasil dari prompt Anda</span></div>}
              </div>
              <label className={styles.uploadButton}><Upload size={16} />{(preview || draft.imageUrl) ? "Ganti gambar" : "Pilih gambar"}<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Gambar contoh" onChange={(event) => selectFile(event.target.files?.[0])} /></label>
              <p className={styles.hint}>{file ? file.name : "JPG, PNG, atau WebP · Maks. 8 MB"}{editingId && !file && <><br />Gambar lama tetap digunakan jika tidak diganti.</>}</p>
              <label className={styles.visibility}><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span><strong>Tampilkan ke pembeli</strong><small>Nonaktifkan untuk menyimpan sebagai draft.</small></span></label>
              <label className={styles.field}>Urutan tampilan<input type="number" min={0} max={100000} value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /><small>Angka lebih kecil ditampilkan lebih dahulu.</small></label>
            </div>
            <div className={styles.detailColumn}>
              <div className={styles.sectionLabel}>DETAIL PROMPT</div>
              <label className={styles.field}>Judul kartu<input autoFocus required minLength={2} maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Contoh: Bakso kuah hangat" /></label>
              <div className={styles.two}>
                <label className={styles.field}>Kategori<select value={draft.group} onChange={(event) => setDraft({ ...draft, group: event.target.value as Draft["group"], typeName: "" })}><option value="FOOD">Makanan</option><option value="DRINK">Minuman</option></select></label>
                <label className={styles.field}>Style<input required minLength={2} maxLength={80} list="prompt-admin-styles" value={draft.typeName} onChange={(event) => setDraft({ ...draft, typeName: event.target.value })} placeholder="Contoh: Minimalis" /><datalist id="prompt-admin-styles">{[...new Set(data?.cards.filter((card) => card.group === draft.group).map((card) => card.typeName))].map((value) => <option key={value} value={value} />)}</datalist></label>
              </div>
              <label className={styles.field}>Isi prompt<textarea required minLength={20} maxLength={20000} rows={8} value={draft.promptText} onChange={(event) => setDraft({ ...draft, promptText: event.target.value })} placeholder="Tulis instruksi lengkap untuk menghasilkan gambar seperti contoh..." /><small>Teks yang akan disalin pembeli <span>{draft.promptText.length.toLocaleString("id-ID")}/20.000</span></small></label>
              <label className={styles.field}>Tips penggunaan <em>opsional</em><textarea maxLength={2000} rows={3} value={draft.usageTips} onChange={(event) => setDraft({ ...draft, usageTips: event.target.value })} placeholder="Contoh: Unggah foto produk dengan latar polos." /><small>Ditampilkan pada kartu, tidak ikut disalin.</small></label>
            </div>
          </fieldset>
        </div>
        <footer className={styles.dialogFooter}><span><Check size={14} />{draft.active ? "Akan ditampilkan ke pembeli" : "Disimpan sebagai draft"}</span><div><button className="button secondary" type="button" disabled={busy} onClick={closeEditor}>Batal</button><button className="button primary" type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Simpan kartu"}</button></div></footer>
      </form>}
    </dialog>
  </>;
}

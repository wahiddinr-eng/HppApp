"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, CheckCircle2, CircleAlert, Eye, EyeOff, KeyRound, RefreshCw, Save, ShieldCheck, TestTube2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageTop } from "./shell";
import styles from "./admin-meta-settings.module.css";

type Settings = { source:"admin"|"environment"; enabled:boolean; active:boolean; pixelId:string; hasToken:boolean;
  tokenUnreadable:boolean; graphApiVersion:string; testEventCode:string; version:number; updatedAt:string|null;
  summary:{pending:number;failed:number;sent:number} };

export function AdminMetaSettings() {
  const [settings,setSettings] = useState<Settings>();
  const [token,setToken] = useState("");
  const [clearToken,setClearToken] = useState(false);
  const [showToken,setShowToken] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const load = useCallback(async () => {
    try { setSettings(await api<Settings>("/api/admin/meta")); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Pengaturan Meta gagal dimuat."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  function change<K extends keyof Settings>(key:K,value:Settings[K]) { setSettings(current => current ? {...current,[key]:value} : current); }
  async function save(event:FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{message:string}>("/api/admin/meta", { method:"PUT", body:JSON.stringify({
        version:settings.version, enabled:settings.enabled, pixelId:settings.pixelId.trim(),
        capiToken:token.trim() || undefined, clearToken, graphApiVersion:settings.graphApiVersion.trim(),
        testEventCode:settings.testEventCode.trim(),
      }) });
      setToken(""); setClearToken(false); setNotice(result.message); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Pengaturan gagal disimpan."); }
    finally { setBusy(false); }
  }
  async function retry() {
    if (!window.confirm("Coba ulang event CAPI yang gagal untuk Pixel saat ini?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{message:string}>("/api/admin/meta", { method:"POST", body:JSON.stringify({action:"retry_failed"}) });
      setNotice(result.message); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Event gagal dijadwalkan ulang."); }
    finally { setBusy(false); }
  }
  const active = Boolean(settings?.active);
  const testing = Boolean(settings?.testEventCode);
  const stateLabel = active ? testing ? "Aktif · kode tes CAPI" : "Aktif · produksi" : settings?.enabled ? "Belum siap" : "Nonaktif";
  return <>
    <PageTop eyebrow="PEMASARAN" title="Meta Pixel & CAPI" description="Kelola pelacakan iklan KulinerKit dari satu halaman. Gunakan dataset terpisah dari LRMobileID."/>
    {error && <p className="form-message error" role="alert">{error}</p>}
    {notice && <p className="form-message" role="status">{notice}</p>}
    <section className={`${styles.statusBanner} ${active ? styles.active : styles.inactive}`} aria-label="Status Meta">
      <div className={styles.statusIcon}>{active ? <CheckCircle2 size={22}/> : <CircleAlert size={22}/>}</div>
      <div><span>STATUS INTEGRASI</span><h2>{settings ? stateLabel : "Memuat pengaturan..."}</h2>
        <p>{!settings ? "Membaca pengaturan saat ini." : active ? testing ? "Event CAPI memakai kode tes; Pixel browser tetap berjalan normal. Hapus kode tes sebelum kampanye produksi." : "Pelacakan dinyalakan. Periksa Events Manager untuk memastikan event benar-benar diterima." : settings.tokenUnreadable ? "Token tersimpan tidak dapat dibaca. Masukkan token CAPI baru." : settings.enabled ? "Periksa Pixel ID dan token CAPI, lalu simpan kembali." : "Tidak ada event KulinerKit yang dikirim ke Meta saat integrasi nonaktif."}</p></div>
      {settings?.source === "environment" && <span className={styles.source}>Sumber lama: environment</span>}
    </section>
    <div className={styles.grid}>
      <form className={styles.panel} onSubmit={save}>
        <div className={styles.panelHead}><span>01 / DATASET</span><h2>Identitas Pixel</h2><p>Masukkan Pixel ID dari dataset khusus KulinerKit di Meta Events Manager.</p></div>
        <label className={styles.field}>Pixel ID<input inputMode="numeric" pattern="[0-9]{8,25}" maxLength={25} value={settings?.pixelId ?? ""} onChange={event=>change("pixelId",event.target.value)} placeholder="Contoh: 123456789012345" aria-describedby="pixel-help" disabled={!settings||busy}/><small id="pixel-help">Hanya angka, 8–25 digit. Jangan gunakan Pixel LRMobileID.</small></label>

        <div className={styles.divider}/>
        <div className={styles.panelHead}><span>02 / CONVERSIONS API</span><h2>Koneksi server</h2><p>Token dipakai worker untuk mengirim event ke Meta; tidak pernah dikirim ke browser.</p></div>
        <label className={styles.field}>Access token CAPI
          <span className={styles.secretInput}><input type={showToken?"text":"password"} autoComplete="new-password" spellCheck={false} value={token} onChange={event=>{setToken(event.target.value);setClearToken(false);}} placeholder={settings?.hasToken?"Token tersimpan · isi hanya untuk mengganti":"Tempel token dari Events Manager"} disabled={!settings||busy||clearToken}/><button type="button" aria-label={showToken?"Sembunyikan token":"Tampilkan token"} onClick={()=>setShowToken(value=>!value)} disabled={!token}>{showToken?<EyeOff size={17}/>:<Eye size={17}/>}</button></span>
          <small>{settings?.tokenUnreadable?"Token lama tidak dapat dibuka; wajib diganti.":settings?.hasToken?"Token sudah tersimpan. Biarkan kosong jika tidak ingin mengganti.":"Belum ada token tersimpan."}</small>
        </label>
        {settings?.hasToken && <label className={styles.clear}><input type="checkbox" checked={clearToken} onChange={event=>{setClearToken(event.target.checked);if(event.target.checked)setToken("");}} disabled={busy}/> Hapus token yang tersimpan</label>}
        <label className={styles.field}>Versi Graph API<input value={settings?.graphApiVersion ?? "v26.0"} onChange={event=>change("graphApiVersion",event.target.value)} pattern="v[0-9]{1,2}\.[0-9]{1,2}" maxLength={7} placeholder="v26.0" disabled={!settings||busy}/><small>Contoh: v26.0. Ubah hanya bila versi API Meta yang digunakan berubah.</small></label>
        <label className={styles.field}>Kode tes event <span className={styles.optional}>opsional</span><input value={settings?.testEventCode ?? ""} onChange={event=>change("testEventCode",event.target.value)} maxLength={64} placeholder="Kosongkan untuk event produksi" disabled={!settings||busy}/><small>Ambil di Events Manager → Test Events. Kode ini berlaku pada event CAPI, bukan Pixel browser.</small></label>
        {testing && <div className={styles.testWarning}><TestTube2 size={18}/><span>Kode tes CAPI aktif. Kosongkan kode tes dan simpan lagi sebelum menjalankan iklan produksi.</span></div>}
        <label className={styles.toggle}><input type="checkbox" checked={settings?.enabled ?? false} onChange={event=>change("enabled",event.target.checked)} disabled={!settings||busy}/><span><strong>Aktifkan Meta Pixel & CAPI</strong><small>Mulai mengirim ViewContent, InitiateCheckout, dan Purchase setelah pengaturan lengkap.</small></span></label>
        <div className={styles.actions}><button type="submit" className="button primary" disabled={!settings||busy}><Save size={16}/>{busy?"Menyimpan...":"Simpan pengaturan"}</button><span><ShieldCheck size={15}/> Token terenkripsi dan tidak ditampilkan kembali.</span></div>
      </form>
      <aside className={styles.aside}>
        <section className={styles.panel}><div className={styles.panelHead}><span>ALUR EVENT</span><h2>Apa yang dilacak?</h2><p>Tiga momen penting dari penjualan langsung KulinerKit.</p></div>
          <div className={styles.event}><span>01</span><div><strong>ViewContent</strong><small>Pengunjung melihat landing page.</small></div><b>Pixel + CAPI</b></div>
          <div className={styles.event}><span>02</span><div><strong>InitiateCheckout</strong><small>Pengunjung membuka checkout aktif.</small></div><b>Pixel + CAPI</b></div>
          <div className={styles.event}><span>03</span><div><strong>Purchase</strong><small>Admin memverifikasi dana dan mengubah status ke complete.</small></div><b>CAPI server</b></div>
          <p className={styles.asideNote}>Pembelian lewat webhook LRMobileID tidak dikirim ke dataset ini. Halaman pembayaran bertoken juga tidak memasang Pixel.</p>
        </section>
        <section className={styles.panel}><div className={styles.panelHead}><span>KESEHATAN PENGIRIMAN</span><h2>Ringkasan CAPI</h2><p>Untuk Pixel dan mode tes/produksi saat ini; bukan laporan atribusi iklan.</p></div>
          <div className={styles.summary}><div><strong>{settings?.summary.sent ?? "—"}</strong><span>Diterima Meta</span></div><div><strong>{settings?.summary.pending ?? "—"}</strong><span>Menunggu</span></div><div><strong>{settings?.summary.failed ?? "—"}</strong><span>Perlu perhatian</span></div></div>
          <div className={styles.summaryActions}><button type="button" className="button secondary" onClick={()=>void load()} disabled={busy}><RefreshCw size={15}/> Perbarui</button>{Boolean(settings?.summary.failed)&&<button type="button" className="button secondary" onClick={()=>void retry()} disabled={busy||!active}>Coba ulang gagal</button>}</div>
          <p className={styles.asideNote}>“Diterima Meta” berarti API menerima event, bukan jaminan event teratribusi ke iklan.</p>
        </section>
        <a className={styles.external} href="https://www.facebook.com/events_manager2/list" target="_blank" rel="noopener noreferrer">Buka Meta Events Manager <ArrowUpRight size={16}/></a>
      </aside>
    </div>
  </>;
}

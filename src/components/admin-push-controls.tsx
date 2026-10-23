"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import styles from "./admin-push-controls.module.css";

type PushConfig = { enabled: boolean; publicKey: string | null };

function supportsPush() {
  return window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function publicKeyBytes(key: string) {
  const padded = key.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(key.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function matchesKey(subscription: PushSubscription, key: string) {
  const actual = subscription.options.applicationServerKey;
  if (!actual) return false;
  const expected = publicKeyBytes(key);
  const bytes = new Uint8Array(actual);
  return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() || null;
}

export async function revokeAdminPushForCurrentDevice() {
  if (!supportsPush()) return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  try {
    await api("/api/admin/push", { method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }) });
  } finally {
    await subscription.unsubscribe();
  }
}

export function AdminPushControls() {
  const [config, setConfig] = useState<PushConfig>();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [isIPhone, setIsIPhone] = useState(false);

  useEffect(() => {
    let mounted = true;
    const available = supportsPush();
    setSupported(available);
    setIsIPhone(/iPhone|iPad|iPod/.test(navigator.userAgent));
    void api<PushConfig>("/api/admin/push").then(async (result) => {
      if (!mounted) return;
      setConfig(result);
      if (!available || !result.enabled || !result.publicKey || Notification.permission !== "granted") return;
      const subscription = await currentSubscription();
      if (!subscription || !matchesKey(subscription, result.publicKey)) return;
      await api("/api/admin/push", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
      if (mounted) setActive(true);
    }).catch((error) => { if (mounted) setMessage(error instanceof Error ? error.message : "Status notifikasi belum dapat diperiksa."); });
    return () => { mounted = false; };
  }, []);

  async function enable() {
    if (!config?.publicKey || busy || !supportsPush()) return;
    setBusy(true); setMessage("");
    try {
      // iOS requires this request to originate directly from the button tap.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setMessage("Izin notifikasi belum diberikan. Ubah izin situs di pengaturan perangkat jika ingin mencoba lagi."); return; }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !matchesKey(subscription, config.publicKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      let created = false;
      if (!subscription) {
        const bytes = publicKeyBytes(config.publicKey);
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes.buffer as ArrayBuffer });
        created = true;
      }
      try {
        await api("/api/admin/push", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
      } catch (error) {
        if (created) await subscription.unsubscribe();
        throw error;
      }
      setActive(true);
      setMessage("Notifikasi pesanan baru aktif di perangkat ini.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengaktifkan notifikasi.");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMessage("");
    try {
      await revokeAdminPushForCurrentDevice();
      setActive(false);
      setMessage("Notifikasi dimatikan di perangkat ini.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mematikan notifikasi.");
    } finally { setBusy(false); }
  }

  return <section className={styles.card} aria-labelledby="admin-push-title">
    <div className={styles.icon}><Bell size={23} /></div>
    <div className={styles.body}>
      <span className={styles.eyebrow}>PESANAN BARU</span>
      <h2 id="admin-push-title">Notifikasi di perangkat admin</h2>
      <p>Terima pemberitahuan saat ada pesanan checkout KulinerKit baru. Notifikasi hanya memuat kode pesanan; periksa transaksi sebelum mengubah status pembayaran.</p>
      {isIPhone && <p className={styles.hint}><Smartphone size={16} /> Di iPhone: buka situs di Safari → Bagikan → Tambahkan ke Layar Utama. Buka ikon KulinerKit, masuk sebagai admin, lalu aktifkan notifikasi di sini.</p>}
      {config && !config.enabled && <p className={styles.hint}>Notifikasi belum disiapkan di server. Tambahkan kunci VAPID dan jalankan migrasi sebelum mengaktifkannya.</p>}
      {supported === false && <p className={styles.hint}>Web Push belum tersedia di browser ini. Untuk iPhone, buka aplikasi dari ikon Layar Utama dengan iOS 16.4 atau lebih baru.</p>}
      {message && <p className={styles.feedback} role="status">{message}</p>}
    </div>
    <div className={styles.actions}>
      <span className={active ? styles.active : styles.inactive}>{active ? "Aktif di perangkat ini" : "Belum aktif"}</span>
      {active ? <button className="button secondary" type="button" onClick={() => void disable()} disabled={busy}><BellOff size={16} /> Matikan</button>
        : <button className="button primary" type="button" onClick={() => void enable()} disabled={busy || supported !== true || !config?.enabled}><Bell size={16} /> {busy ? "Menyiapkan..." : "Aktifkan notifikasi"}</button>}
    </div>
  </section>;
}

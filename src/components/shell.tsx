"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { KULINERKIT_WHATSAPP_URL } from "@/lib/support";
import { BookOpenText, ChartColumnIncreasing, CircleHelp, Images, Layers3, LayoutDashboard, Menu, MessageCircle, Settings2, ShieldCheck, ShoppingBag, Store } from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [user, setUser] = useState<{ name: string; email: string; role: string }>();
  const [features, setFeatures] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => { void api<{ user: { name: string; email: string; role: string }; features: string[] }>("/api/profile")
    .then(result => { setUser(result.user); setFeatures(result.features); }).catch(() => undefined); }, []);
  const canCalculate = features.includes("hpp_calculator");
  const canGallery = user?.role === "admin" || features.includes("prompt_gallery");
  const isHpp = path.startsWith("/app/calculations/") && !path.endsWith("/channels");
  const isPrice = path.startsWith("/app/channels") || path.endsWith("/channels");
  const isSales = path === "/app/sales";
  const isAnalysis = path.startsWith("/app/sales/analysis");
  const logout = async () => { try { await api("/api/auth/sign-out", { method: "POST", body: "{}" }); window.location.assign("/login"); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Gagal keluar."); } };
  const brand = <><span className="brand-mark">k<span>.</span></span><span className="brand-text">Kuliner <small>KIT</small></span></>;

  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/app" className="brand" aria-label="KulinerKit beranda">{brand}</Link>
      <div className="sidebar-scroll">
        <div className="workspace-label">BERANDA</div>
        <nav className="side-nav" aria-label="Navigasi utama">
          {canCalculate && <Link className={path === "/app/calculations" ? "active" : ""} href="/app/calculations"><LayoutDashboard size={18} /> Ringkasan</Link>}
          {canCalculate && <><div className="sidebar-divider" /><div className="workspace-label">SIAPKAN HARGA</div>
            <Link className={path === "/app/ingredients" ? "active" : ""} href="/app/ingredients"><Layers3 size={18} /> Bahan & harga</Link>
            <Link className={isHpp ? "active" : ""} href="/app/calculations/new"><BookOpenText size={18} /> Kalkulator HPP</Link>
            <Link className={isPrice ? "active" : ""} href="/app/channels"><Store size={18} /> Harga per kanal</Link></>}
          {canGallery && <><div className="sidebar-divider" /><div className="workspace-label">SIAPKAN PROMOSI</div>
            <Link className={path.startsWith("/app/prompts") ? "active" : ""} href="/app/prompts"><Images size={18} /> Galeri Prompt</Link></>}
          {canCalculate && <><div className="sidebar-divider" /><div className="workspace-label">PANTAU PENJUALAN</div>
            <Link className={isSales ? "active" : ""} href="/app/sales"><ShoppingBag size={18} /> Penjualan Harian</Link>
            <Link className={isAnalysis ? "active" : ""} href="/app/sales/analysis"><ChartColumnIncreasing size={18} /> Analisis Penjualan</Link></>}
          <div className="sidebar-divider" /><div className="workspace-label">AKUN</div>
          <Link className={path === "/app/profile" ? "active" : ""} href="/app/profile"><Settings2 size={18} /> Profil usaha</Link>
          <Link className={path === "/app/access" ? "active" : ""} href="/app/access"><CircleHelp size={18} /> Status akses</Link>
          {user?.role === "admin" && <><div className="sidebar-divider" /><div className="workspace-label">ADMINISTRASI</div>
            <Link href="/admin"><ShieldCheck size={18} /> Buka panel admin</Link></>}
        </nav>
      </div>
      <div className="sidebar-bottom">{user?.role === "user" && <Link href="/app/guide" className={`sidebar-guide${path === "/app/guide" ? " active" : ""}`}><BookOpenText size={19} /><span><b>Panduan penggunaan</b><small>Buka kembali kapan saja</small></span></Link>}
        {user?.role === "user" && <a className="sidebar-support" href={KULINERKIT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/><span><b>WhatsApp bantuan</b><small>Tim KulinerKit · 0851 6121 8257</small></span></a>}
        <button className="side-help" onClick={() => void logout()}>Keluar akun</button>{notice && <small role="alert">{notice}</small>}
        <div className="side-profile"><div className="avatar">{(user?.name || "A").slice(0, 2).toUpperCase()}</div><div><b>{user?.name || "Akun"}</b><small>{user?.role === "admin" ? "Administrator" : "Akun pembeli"}</small></div></div>
      </div>
    </aside>
    <div className="main-area"><div className="mobile-header"><Link href="/app" className="brand" aria-label="KulinerKit beranda">{brand}</Link><Link href={user?.role==="admin"?"/admin":"/app/tools"} className="mobile-new" aria-label={user?.role==="admin"?"Buka panel admin":"Lihat semua menu"}>{user?.role==="admin"?<ShieldCheck size={19}/>:<Menu size={19}/>}</Link></div>
      <main className="content">{children}</main>
      <nav className="mobile-nav" aria-label="Navigasi seluler">
        {canCalculate && <><Link href="/app/calculations" className={path === "/app/calculations" ? "active" : ""}><LayoutDashboard size={19} />Ringkasan</Link>
          <Link href="/app/calculations/new" className={isHpp ? "active" : ""}><BookOpenText size={19} />HPP</Link>
          <Link href="/app/sales" className={isSales ? "active" : ""}><ShoppingBag size={19} />Jualan</Link>
          <Link href="/app/sales/analysis" className={isAnalysis ? "active" : ""}><ChartColumnIncreasing size={19} />Analisis</Link></>}
        {!canCalculate && canGallery && <Link href="/app/prompts" className={path.startsWith("/app/prompts") ? "active" : ""}><Images size={19} />Prompt</Link>}
        {user?.role==="admin"&&<Link href="/admin"><ShieldCheck size={19}/>Admin</Link>}
        <Link href="/app/tools" className={path === "/app/tools" ? "active" : ""}><Menu size={19} />Lainnya</Link>
      </nav>
    </div>
  </div>;
}

export function PageTop({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="page-top"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

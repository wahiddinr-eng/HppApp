"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {useEffect,useState} from "react";
import {api} from "@/lib/api";
import { BarChart3, BookOpenText, CircleHelp, LayoutDashboard, Plus, Settings2 } from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [user,setUser]=useState<{name:string;email:string;role:string}>();
  const [notice,setNotice]=useState("");
  useEffect(()=>{void api<{user:{name:string;email:string;role:string}}>("/api/profile").then(result=>setUser(result.user)).catch(()=>undefined);},[]);
  const logout=async()=>{try{await api("/api/auth/sign-out",{method:"POST",body:"{}"});window.location.assign("/login");}catch(error){setNotice(error instanceof Error?error.message:"Gagal keluar.");}};
  return <div className="app-shell">
    <aside className="sidebar">
      <div><Link href="/app/calculations" className="brand"><span className="brand-mark">h<span>.</span></span><span className="brand-text">HPP <small>KULINER</small></span></Link>
        <div className="workspace-label">RUANG KERJA</div>
        <nav className="side-nav" aria-label="Navigasi utama">
          <Link className={path === "/app/calculations" ? "active" : ""} href="/app/calculations"><LayoutDashboard size={18} /> Ringkasan</Link>
          <Link className={path.includes("/calculations/") ? "active" : ""} href="/app/calculations/new"><BookOpenText size={18} /> Perhitungan</Link>
          <Link className={path === "/app/profile" ? "active" : ""} href="/app/profile"><Settings2 size={18} /> Profil usaha</Link>
          <Link className={path === "/app/access" ? "active" : ""} href="/app/access"><CircleHelp size={18}/> Status akses</Link>
          {user?.role==="admin"&&<><Link href="/admin/access" className={path==="/admin/access"?"active":""}>Kelola akses</Link><Link href="/admin/integrations" className={path==="/admin/integrations"?"active":""}>Integrasi</Link></>}
        </nav>
        <div className="sidebar-divider" />
        <div className="workspace-label">AKSI CEPAT</div>
        <Link href="/app/calculations/new" className="quick-add"><Plus size={17} /> Perhitungan baru</Link>
      </div>
      <div className="sidebar-bottom"><div className="sidebar-tip"><BarChart3 size={19} /><b>Angka lebih jelas,<br />keputusan lebih yakin.</b><span>Kenali biaya setiap produk sebelum menentukan harga jual.</span></div><button className="side-help" onClick={()=>void logout()}>Keluar akun</button>{notice&&<small role="alert">{notice}</small>}<div className="side-profile"><div className="avatar">{(user?.name||"A").slice(0,2).toUpperCase()}</div><div><b>{user?.name||"Akun"}</b><small>{user?.role==="admin"?"Administrator":"Akun pembeli"}</small></div></div></div>
    </aside>
    <div className="main-area"><div className="mobile-header"><Link href="/app/calculations" className="brand"><span className="brand-mark">h<span>.</span></span><span className="brand-text">HPP <small>KULINER</small></span></Link><Link href="/app/calculations/new" className="mobile-new" aria-label="Perhitungan baru"><Plus size={19} /></Link></div><main className="content">{children}</main><nav className="mobile-nav" aria-label="Navigasi seluler"><Link href="/app/calculations" className={path === "/app/calculations" ? "active" : ""}><LayoutDashboard size={19} />Ringkasan</Link><Link href="/app/calculations/new" className={path.includes("/calculations/") ? "active" : ""}><BookOpenText size={19} />Hitung HPP</Link><Link href="/app/profile" className={path === "/app/profile" ? "active" : ""}><Settings2 size={19} />Profil</Link></nav></div>
  </div>;
}

export function PageTop({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="page-top"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

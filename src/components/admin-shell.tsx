"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Images, LayoutDashboard, LogOut, MailCheck, ShieldCheck, UsersRound } from "lucide-react";
import { api } from "@/lib/api";
import styles from "./admin-shell.module.css";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, description: "Ringkasan operasional" },
  { href: "/admin/access", label: "Pengguna & akses", icon: UsersRound, description: "Akun dan hak fitur" },
  { href: "/admin/integrations", label: "Integrasi & email", icon: MailCheck, description: "Webhook dan pengiriman" },
  { href: "/admin/prompts", label: "Kartu Prompt", icon: Images, description: "Konten galeri" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [profile, setProfile] = useState<{ name: string; email: string }>();
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void api<{ user: { name: string; email: string } }>("/api/profile")
      .then(result => setProfile(result.user)).catch(() => undefined);
  }, []);
  async function logout() {
    try {
      await api("/api/auth/sign-out", { method: "POST", body: "{}" });
      window.location.assign("/login");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Gagal keluar dari akun.");
    }
  }

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/admin" className={styles.brand} aria-label="KulinerKit Admin - dashboard">
        <span className={styles.brandMark}>K</span>
        <span><strong>KulinerKit</strong><small>ADMIN WORKSPACE</small></span>
      </Link>
      <div className={styles.menuLabel}>MENU ADMIN</div>
      <nav className={styles.nav} aria-label="Navigasi admin">
        {links.map(({ href, label, icon: Icon, description }) => {
          const active = path === href;
          return <Link key={href} href={href} className={`${styles.navLink}${active ? ` ${styles.active}` : ""}`} aria-current={active ? "page" : undefined}>
            <span className={styles.navIcon}><Icon size={19} /></span><span><strong>{label}</strong><small>{description}</small></span>
          </Link>;
        })}
      </nav>
      <div className={styles.sidebarBottom}>
        <Link href="/app" className={styles.customerLink}><ArrowLeft size={17} /> Lihat aplikasi customer</Link>
        <div className={styles.profile}><span className={styles.avatar}>{(profile?.name || "A").slice(0, 2).toUpperCase()}</span><span><strong>{profile?.name || "Administrator"}</strong><small>{profile?.email || "Akun admin"}</small></span></div>
        <button className={styles.logout} onClick={() => void logout()}><LogOut size={17} /> Keluar akun</button>
        {notice && <small role="alert" className={styles.notice}>{notice}</small>}
      </div>
    </aside>
    <div className={styles.main}>
      <header className={styles.header}>
        <div><span className={styles.headerKicker}><ShieldCheck size={15} /> AREA ADMINISTRATOR</span><strong>Kelola KulinerKit</strong></div>
        <div className={styles.headerActions}><Link href="/app" className={styles.headerCustomer}>Lihat aplikasi customer <ArrowLeft size={15} /></Link><button className={styles.headerLogout} onClick={() => void logout()} aria-label="Keluar akun admin"><LogOut size={17}/></button></div>
      </header>
      <nav className={styles.mobileNav} aria-label="Navigasi admin seluler">
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href ? styles.mobileActive : ""} aria-current={path === href ? "page" : undefined}><Icon size={17} />{label}</Link>)}
      </nav>
      <main className={styles.content}>{children}</main>
    </div>
  </div>;
}

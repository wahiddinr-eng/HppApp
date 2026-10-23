"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import styles from "./landing.module.css";

const links = [{ href: "#fitur", label: "Isi toolkit" }, { href: "#cara-kerja", label: "Cara mulai" }, { href: "#faq", label: "Tanya jawab" }];

export function LandingNav() {
  const [open, setOpen] = useState(false);
  return <header className={styles.header}>
    <div className={styles.navbar}>
      <Link href="/" className={styles.brand} aria-label="KulinerKit by LRMobileID — beranda"><span className={styles.brandMark} aria-hidden="true">k<span>k</span></span><span className={styles.brandName}>Kuliner<span>Kit</span><small>by LRMobileID</small></span></Link>
      <nav className={styles.desktopNav} aria-label="Navigasi utama">{links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
      <div className={styles.navActions}><Link href="/login" className={styles.loginLink}>Masuk</Link><a href="#mulai" className={styles.navCta}>Kenali KulinerKit <ArrowUpRight size={16} /></a></div>
      <button className={styles.menuToggle} type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="landing-mobile-menu" aria-label={open ? "Tutup menu" : "Buka menu"}>{open ? <X size={22} /> : <Menu size={22} />}</button>
    </div>
    {open && <nav id="landing-mobile-menu" className={styles.mobileMenu} aria-label="Navigasi ponsel" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
      {links.map(link => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowUpRight size={16} /></a>)}
      <Link href="/login">Masuk ke akun <ArrowUpRight size={16} /></Link>
      <a href="#mulai" onClick={() => setOpen(false)}>Kenali KulinerKit <ArrowUpRight size={16} /></a>
    </nav>}
  </header>;
}

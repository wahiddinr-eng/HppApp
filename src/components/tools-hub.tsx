"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenText, ChartColumnIncreasing, CircleHelp, Images, Layers3, MessageCircle, Settings2, ShieldCheck, ShoppingBag, Store, Target } from "lucide-react";
import { api } from "@/lib/api";
import { KULINERKIT_WHATSAPP_URL } from "@/lib/support";
import { PageTop, Shell } from "./shell";
import styles from "./sales.module.css";

export function ToolsHub() {
  const [features, setFeatures] = useState<string[]>([]);
  const [role, setRole] = useState("");
  useEffect(() => { void api<{ features: string[]; user: { role: string } }>("/api/profile")
    .then(result => { setFeatures(result.features); setRole(result.user.role); }).catch(() => undefined); }, []);
  const calc = features.includes("hpp_calculator");
  const gallery = role === "admin" || features.includes("prompt_gallery");
  const sections = [
    { title: "Siapkan harga", items: calc ? [
      { href: "/app/ingredients", icon: Layers3, title: "Bahan & Riwayat Harga", description: "Ubah harga bahan sekali dan lihat resep yang terdampak." },
      { href: "/app/calculations/new", icon: BookOpenText, title: "Kalkulator HPP", description: "Hitung biaya dan tentukan harga dasar." },
      { href: "/app/channels", icon: Store, title: "Harga per kanal", description: "Simulasikan harga GoFood dan kanal lainnya." },
      { href: "/app/profit-target", icon: Target, title: "Target Untung & Titik Impas", description: "Tetapkan target hasil usaha tanpa membagi menu atau kanal." },
    ] : [] },
    { title: "Siapkan promosi", items: gallery ? [
      { href: "/app/prompts", icon: Images, title: "Galeri Prompt", description: "Temukan ide visual untuk promosi produk." },
    ] : [] },
    { title: "Pantau penjualan", items: calc ? [
      { href: "/app/sales", icon: ShoppingBag, title: "Penjualan Harian", description: "Catat hasil jualan per menu dan kanal." },
      { href: "/app/sales/analysis", icon: ChartColumnIncreasing, title: "Analisis Penjualan", description: "Lihat menu terlaris dan sumber pesanan." },
    ] : [] },
    { title: "Akun", items: [
      { href: "/app/profile", icon: Settings2, title: "Profil usaha", description: "Kelola nama usaha dan password." },
      { href: "/app/access", icon: CircleHelp, title: "Status akses", description: "Periksa fitur yang dapat digunakan." },
      ...(role === "admin" ? [{ href: "/admin", icon: ShieldCheck, title: "Panel Admin", description: "Pantau pengguna, pembelian, integrasi, dan kartu prompt." }] : []),
    ] },
    { title: "Bantuan", items: role === "user" ? [
      { href: "/app/guide", icon: BookOpenText, title: "Panduan penggunaan", description: "Lihat urutan awal dan cara memakai tiap fitur." },
      { href: KULINERKIT_WHATSAPP_URL, icon: MessageCircle, title: "WhatsApp bantuan KulinerKit", description: "Hubungi tim bantuan penggunaan aplikasi." },
    ] : [] },
  ];
  return <Shell><PageTop eyebrow="RUANG KERJA" title="Semua menu" description="Pilih alat sesuai tahap usaha yang sedang Anda kerjakan." />
    <div className={styles.toolSections}>{sections.filter(section => section.items.length).map(section => <section key={section.title}><h2>{section.title}</h2><div>{section.items.map(item => {
      const content=<><item.icon size={21} /><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowRight size={16} /></>;
      return item.href.startsWith("https://")?<a href={item.href} key={item.href} target="_blank" rel="noopener noreferrer">{content}</a>:<Link href={item.href} key={item.href}>{content}</Link>;
    })}</div></section>)}</div>
  </Shell>;
}

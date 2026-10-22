import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: "KulinerKit — Masak pakai hati. Jualan pakai perhitungan.",
  description: "Kenali HPP, tentukan harga jual, siapkan promosi, dan pantau penjualan. KulinerKit menemani perjalanan usaha kuliner Anda dari satu menu pertama.",
  alternates: { canonical: "https://hpp.lrmobileid.com" },
  openGraph: {
    title: "KulinerKit — Bekal untuk usaha kuliner yang lebih terarah",
    description: "Dari menghitung biaya satu menu sampai memahami hasil jualan. Semua bekal usaha kuliner dalam satu tempat.",
    siteName: "KulinerKit", locale: "id_ID", type: "website", url: "https://hpp.lrmobileid.com",
  },
};

export default function Home() { return <LandingPage />; }

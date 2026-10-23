import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

const title = "KulinerKit — Hitung dulu biaya menunya. Lalu siapkan promosinya.";
const description = "Hitung biaya produksi dan tentukan harga jual dengan kalkulator HPP. Siapkan visual promosi makanan dengan prompt siap pakai di alat AI pilihan Anda.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://hpp.lrmobileid.com" },
  openGraph: {
    title,
    description,
    siteName: "KulinerKit", locale: "id_ID", type: "website", url: "https://hpp.lrmobileid.com",
  },
};

export default function Home() { return <LandingPage />; }

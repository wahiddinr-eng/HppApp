import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KulinerKit",
  description: "Hitung biaya, tentukan harga, siapkan promosi, dan pantau penjualan usaha kuliner Anda."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}

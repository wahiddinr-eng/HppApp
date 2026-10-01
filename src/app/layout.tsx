import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kalkulator HPP Kuliner",
  description: "Hitung biaya produksi dan temukan harga jual yang pas untuk usaha kuliner Anda."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}

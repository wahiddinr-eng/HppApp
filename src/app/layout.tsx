import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/pwa-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "KulinerKit",
  description: "Hitung biaya, tentukan harga, siapkan promosi, dan pantau penjualan usaha kuliner Anda.",
  applicationName: "KulinerKit",
  appleWebApp: { capable: true, title: "KulinerKit", statusBarStyle: "default" },
  icons: { icon: "/icons/kulinerkit-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#123d32" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body><PwaRegistration />{children}</body></html>;
}

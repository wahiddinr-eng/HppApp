import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "KulinerKit by LRMobileID",
    short_name: "KulinerKit",
    description: "Hitung HPP, siapkan promosi, dan pantau usaha kuliner Anda.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f5f8f5",
    theme_color: "#123d32",
    icons: [
      { src: "/icons/kulinerkit-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/kulinerkit-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

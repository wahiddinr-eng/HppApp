/* KulinerKit uses this worker for Web Push only; pages and private data are never cached. */
self.addEventListener("push", (event) => {
  let message = {};
  try { message = event.data ? event.data.json() : {}; } catch { /* Show a generic notice. */ }
  const code = typeof message.code === "string" && /^KK-[A-F0-9]{12}$/.test(message.code) ? message.code : "";
  event.waitUntil(self.registration.showNotification("Pesanan baru KulinerKit", {
    body: code ? `Pesanan ${code} masuk. Buka transaksi untuk memeriksanya.` : "Buka transaksi untuk memeriksa pesanan baru.",
    icon: "/icons/kulinerkit-192.png",
    badge: "/icons/kulinerkit-192.png",
    tag: code ? `kulinerkit-order-${code}` : "kulinerkit-order",
    data: { url: "/admin/transactions" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const destination = new URL("/admin/transactions", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(destination);
      return existing.focus();
    }
    return self.clients.openWindow(destination);
  })());
});

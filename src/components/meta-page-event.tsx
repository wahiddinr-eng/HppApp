"use client";
import { useEffect, useRef } from "react";

type EventName = "ViewContent" | "InitiateCheckout";
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[][]; loaded?: boolean; version?: string };
type PixelWindow = Window & { fbq?: Fbq };
const productId = "kulinerkit_bundle";
const initialized = new Set<string>();

function persistClickId() {
  const clickId = new URLSearchParams(window.location.search).get("fbclid");
  if (!clickId || !/^[A-Za-z0-9._-]{1,200}$/.test(clickId)) return;
  const value = `fb.1.${Date.now()}.${clickId}`;
  document.cookie = `_fbc=${encodeURIComponent(value)}; Max-Age=7776000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

function initPixel(pixelId: string) {
  const target = window as PixelWindow;
  if (!target.fbq) {
    const fbq = ((...args: unknown[]) => { if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue?.push(args); }) as Fbq;
    fbq.queue = []; fbq.loaded = true; fbq.version = "2.0";
    target.fbq = fbq;
    const script = document.createElement("script");
    script.async = true; script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  if (!initialized.has(pixelId)) { target.fbq("init", pixelId); initialized.add(pixelId); }
  return target.fbq;
}

export function MetaPageEvent({ name, price }: { name: EventName; price: number }) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current || !Number.isFinite(price) || price <= 0) return;
    tracked.current = true;
    void fetch("/api/meta/events", { cache: "no-store" })
      .then(response => response.ok ? response.json() as Promise<{ enabled: boolean; pixelId: string | null }> : null)
      .then(config => {
        if (!config?.enabled || !config.pixelId) return;
        persistClickId();
        const eventId = crypto.randomUUID();
        const data = { currency: "IDR", value: price, content_name: "KulinerKit", content_category: "Toolkit usaha kuliner",
          content_type: "product", content_ids: [productId], contents: [{ id: productId, quantity: 1, item_price: price }], num_items: 1 };
        initPixel(config.pixelId)("trackSingle", config.pixelId, name, data, { eventID: eventId });
        // Allow Pixel to set _fbp, but flush immediately if the visitor leaves first.
        let submitted = false;
        const submit = () => {
          if (submitted) return;
          submitted = true;
          window.removeEventListener("pagehide", submit);
          void fetch("/api/meta/events", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, eventId }), keepalive: true }).catch(() => undefined);
        };
        window.addEventListener("pagehide", submit, { once: true });
        window.setTimeout(submit, 500);
      }).catch(() => undefined);
  }, [name, price]);
  return null;
}

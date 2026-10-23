"use client";
import { useEffect, useRef } from "react";
import { fbcForClickId, fbcHasClickId, validFbclid } from "@/lib/meta-click-id";

type EventName = "ViewContent" | "InitiateCheckout";
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[][]; loaded?: boolean; version?: string };
type PixelWindow = Window & { fbq?: Fbq };
const productId = "kulinerkit_bundle";
const initialized = new Set<string>();
const pendingClickIdKey = "kulinerkit:meta:pending-fbclid";

export function rememberClickId() {
  const clickId = new URLSearchParams(window.location.search).get("fbclid");
  if (!validFbclid(clickId)) return;
  try { sessionStorage.setItem(pendingClickIdKey, clickId); } catch { /* Storage may be unavailable. */ }
}

function persistClickId() {
  const current = new URLSearchParams(window.location.search).get("fbclid");
  let pending: string | null = null;
  try { pending = sessionStorage.getItem(pendingClickIdKey); } catch { /* Storage may be unavailable. */ }
  const clickId = validFbclid(current) ? current : pending;
  const value = fbcForClickId(clickId);
  if (!value || !validFbclid(clickId)) return;
  const existing = document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith("_fbc="));
  let existingValue: string | undefined;
  try { existingValue = existing ? decodeURIComponent(existing.slice(5)) : undefined; } catch { /* Ignore a malformed cookie. */ }
  if (fbcHasClickId(existingValue, clickId)) {
    try { sessionStorage.removeItem(pendingClickIdKey); } catch { /* Storage may be unavailable. */ }
    return;
  }
  document.cookie = `_fbc=${encodeURIComponent(value)}; Max-Age=7776000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  try { sessionStorage.removeItem(pendingClickIdKey); } catch { /* Storage may be unavailable. */ }
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
    // Keep the ad click through an immediate SPA navigation while config loads.
    rememberClickId();
    void fetch("/api/meta/events", { cache: "no-store" })
      .then(response => response.ok ? response.json() as Promise<{ enabled: boolean; pixelId: string | null }> : null)
      .then(config => {
        if (!config?.enabled || !config.pixelId) {
          try { sessionStorage.removeItem(pendingClickIdKey); } catch { /* Storage may be unavailable. */ }
          return;
        }
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

export function trackPurchasePixel(pixelId: string, eventId: string, price: number, orderCode: string) {
  // Never initialize Meta while the bearer payment token remains in the URL.
  if (window.location.pathname !== "/pay/verified") return false;
  persistClickId();
  initPixel(pixelId)("trackSingle", pixelId, "Purchase", {
    currency: "IDR", value: price, content_name: "KulinerKit", content_category: "Toolkit usaha kuliner",
    content_type: "product", content_ids: [productId], contents: [{ id: productId, quantity: 1, item_price: price }],
    num_items: 1, order_id: orderCode,
  }, { eventID: eventId });
  return true;
}

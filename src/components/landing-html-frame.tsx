"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export function landingHtmlDocument(html: string, channel: string) {
  const safeChannel = JSON.stringify(channel).replace(/</g, "\\u003c");
  const bridge = `<script>(()=>{const channel=${safeChannel};let pageUrl="";
    const sendHeight=()=>{const a=document.documentElement,b=document.body;parent.postMessage({type:"kk:html-height",channel,height:Math.max(a.scrollHeight,b.scrollHeight,a.getBoundingClientRect().height,b.getBoundingClientRect().height)},"*")};
    document.addEventListener("click",event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const link=event.target instanceof Element?event.target.closest("a[href]"):null;if(!link||link.hasAttribute("download"))return;
      const href=link.getAttribute("href")?.trim();if(!href)return;let hash="";
      if(href.startsWith("#"))hash=href;else if(pageUrl){try{const target=new URL(href,pageUrl),current=new URL(pageUrl);if(target.origin===current.origin&&target.pathname===current.pathname&&target.search===current.search)hash=target.hash}catch{}}
      if(!hash||hash==="#")return;event.preventDefault();parent.postMessage({type:"kk:html-anchor",channel,hash},"*");
    },true);
    addEventListener("message",event=>{const data=event.data;if(event.source!==parent||data?.type!=="kk:html-config"||data.channel!==channel)return;
      try{const url=new URL(String(data.pageUrl));if(url.protocol==="https:"||url.hostname==="localhost")pageUrl=url.href}catch{}sendHeight();});
    new ResizeObserver(sendHeight).observe(document.documentElement);new ResizeObserver(sendHeight).observe(document.body);
    addEventListener("load",sendHeight);sendHeight();parent.postMessage({type:"kk:html-ready",channel},"*");
  })()</script>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; media-src https: data: blob:; style-src 'unsafe-inline' https:; font-src https: data:; script-src 'unsafe-inline' https:; connect-src https: wss:; frame-src https: data: blob:; object-src https: data: blob:; form-action https:; base-uri 'none'"><base target="_blank"><style>html,body{margin:0;width:100%;min-width:0;overflow-x:hidden;font-family:system-ui,sans-serif}*{box-sizing:border-box}img,video,iframe,object,embed{max-width:100%}</style></head><body>${html}${bridge}</body></html>`;
}

export function LandingHtmlFrame({ anchorId, html }: { anchorId: string; html: string }) {
  const channel = useId();
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(640);
  const document = useMemo(() => landingHtmlDocument(html, channel), [html, channel]);
  useEffect(() => {
    const current = frame.current;
    const sendConfig = () => current?.contentWindow?.postMessage({ type: "kk:html-config", channel, pageUrl: window.location.href }, "*");
    const receive = (event: MessageEvent) => {
      if (event.source !== current?.contentWindow || event.data?.channel !== channel) return;
      if (event.data.type === "kk:html-ready") { sendConfig(); return; }
      if (event.data.type === "kk:html-height") {
        const measured = Number(event.data.height);
        if (Number.isFinite(measured)) setHeight(Math.min(50_000, Math.max(48, Math.ceil(measured))));
      }
      if (event.data.type === "kk:html-anchor") {
        const hash = event.data.hash;
        if (typeof hash !== "string" || !hash.startsWith("#")) return;
        let targetId: string;
        try { targetId = decodeURIComponent(hash.slice(1)); } catch { return; }
        const target = window.document.getElementById(targetId);
        if (!target?.closest("main[data-landing-renderer]")) return;
        if (window.location.hash !== hash) window.history.pushState(null, "", hash);
        target.scrollIntoView({ block: "start" });
      }
    };
    window.addEventListener("message", receive);
    current?.addEventListener("load", sendConfig);
    sendConfig();
    return () => { window.removeEventListener("message", receive); current?.removeEventListener("load", sendConfig); };
  }, [channel]);
  return <iframe ref={frame} title={`Konten HTML ${anchorId}`} sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-presentation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" scrolling={height >= 50_000 ? "auto" : "no"} srcDoc={document} style={{ display: "block", width: "100%", minWidth: 0, height, border: 0 }} />;
}

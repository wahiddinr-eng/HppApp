import { z } from "zod";

const anchor = z.string().trim().min(2).max(80).regex(/^[a-z][a-z0-9-]*$/, "Anchor harus diawali huruf kecil dan hanya memakai huruf, angka, atau tanda hubung.");
const href = z.string().trim().min(1).max(2048).refine(value => {
  if (/[\s\\]/.test(value)) return false;
  if (/^#[a-z][a-z0-9-]*$/.test(value) || /^\/(?!\/)[^\\\s]*$/.test(value)) return true;
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}, "Gunakan anchor, path internal, atau URL HTTPS.");
const image = z.union([z.literal(""), href.refine(value => !value.startsWith("#"), "Gambar memerlukan URL atau path.")]);
const common = { id: z.uuid(), anchorId: anchor, enabled: z.boolean() };
const line = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max);

export const landingBlockSchema = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal("HERO"), eyebrow: optional(100), title: line(180), body: line(1200), primaryLabel: line(60), primaryHref: href, secondaryLabel: optional(60), secondaryHref: z.union([z.literal(""), href]) }),
  z.object({ ...common, type: z.literal("TEXT"), heading: line(180), body: line(10_000) }),
  z.object({ ...common, type: z.literal("IMAGE"), src: image, alt: line(250), caption: optional(500) }),
  z.object({ ...common, type: z.literal("BENEFITS"), heading: line(180), items: z.array(z.object({ title: line(120), body: line(500) })).min(1).max(12) }),
  z.object({ ...common, type: z.literal("FAQ"), heading: line(180), items: z.array(z.object({ question: line(200), answer: line(1000) })).min(1).max(20) }),
  z.object({ ...common, type: z.literal("CTA"), heading: line(180), body: optional(1200), label: line(60), href }),
  z.object({ ...common, type: z.literal("CUSTOM_HTML"), html: z.string().max(300_000).transform(normalizeCustomHtml).pipe(z.string().min(1, "HTML tidak boleh kosong.")) }),
]);

export const landingBlocksSchema = z.array(landingBlockSchema).max(60).superRefine((blocks, context) => {
  const anchors = new Set<string>();
  for (const [index, block] of blocks.entries()) {
    if (anchors.has(block.anchorId)) context.addIssue({ code: "custom", path: [index, "anchorId"], message: "Anchor ID harus unik." });
    anchors.add(block.anchorId);
  }
});

export const landingPageInputSchema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug tidak valid."),
  title: line(180),
  seoDescription: optional(170),
  status: z.enum(["draft", "published"]),
  metaViewContentEnabled: z.boolean().default(false),
  blocks: landingBlocksSchema,
}).superRefine((page, context) => {
  if (JSON.stringify(page.blocks).length > 750_000)
    context.addIssue({ code: "custom", path: ["blocks"], message: "Total data blok maksimal 750 KB." });
  if (page.status === "published" && !page.blocks.some(block => block.enabled))
    context.addIssue({ code: "custom", path: ["blocks"], message: "Terbitkan sedikitnya satu blok aktif." });
});

export type LandingBlock = z.infer<typeof landingBlockSchema>;
export type LandingPageInput = z.infer<typeof landingPageInputSchema>;
export type LandingPageRecord = LandingPageInput & { id: string; version: number; createdAt: string; updatedAt: string; publishedAt: string | null };

export function normalizeCustomHtml(html: string) {
  return html.trim()
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/<link\b([^>]*)>/gi, (tag, attrs: string) => {
      const rel = attrs.match(/\brel\s*=\s*["']?([^\s"'>]+)/i)?.[1]?.toLowerCase();
      const source = attrs.match(/\bhref\s*=\s*["']?([^\s"'>]+)/i)?.[1] || "";
      return rel === "stylesheet" && (/^https:\/\//i.test(source) || /^\/(?!\/)/.test(source)) ? tag : "";
    })
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, "")
    .trim();
}

export function newLandingBlock(type: LandingBlock["type"], sequence = 1): LandingBlock {
  const common = { id: crypto.randomUUID(), anchorId: `${type.toLowerCase().replace("_", "-")}-${sequence}`, enabled: true };
  switch (type) {
    case "HERO": return { ...common, type, eyebrow: "KULINERKIT", title: "Siapkan usaha kuliner dengan lebih terarah", body: "Hitung biaya, tentukan harga, dan siapkan promosi dari satu tempat.", primaryLabel: "Beli akses", primaryHref: "/checkout", secondaryLabel: "Pelajari manfaat", secondaryHref: "#manfaat" };
    case "TEXT": return { ...common, type, heading: "Ceritakan manfaatnya", body: "Tulis penjelasan singkat yang jelas untuk calon pelanggan." };
    case "IMAGE": return { ...common, type, src: "", alt: "Ilustrasi KulinerKit", caption: "" };
    case "BENEFITS": return { ...common, type, heading: "Yang Anda dapatkan", items: [{ title: "Hitung HPP", body: "Ketahui biaya produksi sebelum menentukan harga jual." }] };
    case "FAQ": return { ...common, type, heading: "Pertanyaan umum", items: [{ question: "Bagaimana cara mendapatkan akses?", answer: "Buat pesanan, lakukan pembayaran, lalu tunggu verifikasi admin." }] };
    case "CTA": return { ...common, type, heading: "Siap mulai?", body: "Dapatkan akses KulinerKit untuk usaha Anda.", label: "Beli akses KulinerKit", href: "/checkout" };
    case "CUSTOM_HTML": return { ...common, type, html: "<section style=\"padding:48px 20px;text-align:center\"><h2>Bagian khusus Anda</h2><p>Ganti HTML ini dengan desain Anda.</p></section>" };
  }
}

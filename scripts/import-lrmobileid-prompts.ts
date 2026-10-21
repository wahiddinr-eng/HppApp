import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { getPool, query, requireBackendConfig, transaction } from "../src/server/db";

const cardSchema = z.object({
  id: z.string().min(1).max(200), productId: z.string().min(1).max(200),
  productName: z.string().min(2).max(200), productDescription: z.string().max(10000).default(""),
  title: z.string().min(2).max(120), group: z.enum(["FOOD", "DRINK"]),
  typeName: z.string().min(2).max(80), imageUrl: z.string().min(1).max(2048),
  promptText: z.string().min(20).max(20000), usageTips: z.string().max(2000).default(""),
  sortOrder: z.number().int().min(0).max(100000), active: z.boolean(),
});

function mimeFromBytes(bytes: Uint8Array) {
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 12 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", ext: "webp" };
  throw new Error("Format gambar tidak didukung.");
}

async function downloadImage(path: string, origin: URL) {
  if (!/^\/(?:api\/media\/|prompt-examples\/)[^?#]+$/.test(path)) throw new Error("Path gambar sumber tidak valid.");
  const url = new URL(path, origin);
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.body) throw new Error(`Unduhan gambar gagal: HTTP ${response.status}.`);
  const claimed = Number(response.headers.get("content-length") || 0);
  if (claimed > 8 * 1024 * 1024) throw new Error("Gambar melebihi 8 MB.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > 8 * 1024 * 1024) { await reader.cancel(); throw new Error("Gambar melebihi 8 MB."); }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  const format = mimeFromBytes(bytes);
  const imageKey = `${createHash("sha256").update(bytes).digest("hex")}.${format.ext}`;
  return { bytes, imageKey, mime: format.mime };
}

requireBackendConfig();
const inputFile = process.argv[2];
if (!inputFile) throw new Error("Gunakan: npm run prompts:import -- /path/ekspor-prompt.json (atau - untuk stdin)");
const origin = new URL(process.env.PROMPT_IMPORT_ORIGIN || "https://app.lrmobileid.com");
// The one-off VPS migration may read the sibling app over its loopback port
// when the public Cloudflare address is unreachable from the same server.
const localSibling = origin.href === "http://127.0.0.1:3000/";
if ((!localSibling && origin.protocol !== "https:") || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
  throw new Error("PROMPT_IMPORT_ORIGIN harus origin HTTPS murni atau http://127.0.0.1:3000/.");
}
const inputText = inputFile === "-"
  ? await new Promise<string>((resolveInput, rejectInput) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolveInput(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", rejectInput);
  })
  : await readFile(resolve(inputFile), "utf8");
const source = JSON.parse(inputText);
const cards = z.array(cardSchema).min(1).max(1000).parse(source);
if (new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error("ID kartu prompt ganda.");
const productIds = [...new Set(cards.map((card) => card.productId))];
const existing = await query("SELECT 1 FROM prompt_gallery_card WHERE product_id=ANY($1::text[]) LIMIT 1", [productIds]);
if (existing.rowCount) { await getPool().end(); throw new Error("Koleksi sudah berisi kartu. Impor hanya boleh sekali agar perubahan admin HppApp tidak tertimpa."); }
const root = resolve(process.cwd(), process.env.PROMPT_MEDIA_ROOT || ".data/prompt-gallery");
await mkdir(root, { recursive: true, mode: 0o700 });

const imported: { card: z.infer<typeof cardSchema>; image: Awaited<ReturnType<typeof downloadImage>> }[] = [];
try {
  for (const card of cards) {
    const image = await downloadImage(card.imageUrl, origin);
    try { await writeFile(resolve(root, image.imageKey), image.bytes, { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    imported.push({ card, image });
  }
  await transaction(async (client) => {
    for (const { card, image } of imported) {
      await client.query(`INSERT INTO prompt_gallery_collection(product_id,name,description) VALUES($1,$2,$3)
        ON CONFLICT(product_id) DO NOTHING`,
      [card.productId, card.productName, card.productDescription]);
      await client.query(`INSERT INTO prompt_gallery_card(id,product_id,title,group_name,type_name,prompt_text,usage_tips,image_key,image_mime,sort_order,active)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [card.id, card.productId, card.title, card.group, card.typeName, card.promptText, card.usageTips,
        image.imageKey, image.mime, card.sortOrder, card.active]);
    }
  });
  console.log(`${imported.length} kartu prompt tersalin ke HppApp. Isi prompt tidak dicetak.`);
} finally { await getPool().end(); }

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DomainError } from "./http";

export const MAX_PROMPT_IMAGE_BYTES = 8 * 1024 * 1024;

function mediaRoot() {
  return resolve(/* turbopackIgnore: true */ process.cwd(), process.env.PROMPT_MEDIA_ROOT || ".data/prompt-gallery");
}

export function detectPromptImage(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes.length > MAX_PROMPT_IMAGE_BYTES) throw new DomainError(422, "INVALID_PROMPT_IMAGE", "Gambar harus berukuran maksimal 8 MB.");
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return { mime: "image/png", ext: "png" };
  if (Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp" };
  throw new DomainError(422, "INVALID_PROMPT_IMAGE", "Gunakan gambar JPG, PNG, atau WebP.");
}

export async function storePromptImage(bytes: Uint8Array) {
  const format = detectPromptImage(bytes);
  const imageKey = `${createHash("sha256").update(bytes).digest("hex")}.${format.ext}`;
  const root = mediaRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  try { await writeFile(resolve(/* turbopackIgnore: true */ root, imageKey), bytes, { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  return { imageKey, mime: format.mime };
}

export async function readStoredPromptImage(imageKey: string, mime: string) {
  if (!/^[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(imageKey) || !["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    throw new DomainError(404, "PROMPT_IMAGE_NOT_FOUND", "Gambar tidak ditemukan.");
  }
  try { return { bytes: await readFile(resolve(/* turbopackIgnore: true */ mediaRoot(), imageKey)), mime }; }
  catch { throw new DomainError(404, "PROMPT_IMAGE_NOT_FOUND", "Gambar tidak ditemukan."); }
}

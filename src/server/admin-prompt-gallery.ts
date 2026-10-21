import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query, transaction } from "./db";
import { type Actor, DomainError, readBody } from "./http";
import { readStoredPromptImage, storePromptImage, MAX_PROMPT_IMAGE_BYTES } from "./prompt-media";

const productId = z.string().trim().min(2).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const collectionSchema = z.object({
  productId, name: z.string().trim().min(2).max(200), description: z.string().trim().max(10000).default(""),
});
export const cardSchema = z.object({
  productId, title: z.string().trim().min(2).max(120), group: z.enum(["FOOD", "DRINK"]),
  typeName: z.string().trim().min(2).max(80), promptText: z.string().trim().min(20).max(20000),
  usageTips: z.string().trim().max(2000), sortOrder: z.coerce.number().int().min(0).max(100000),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});
export type AdminCardInput = z.infer<typeof cardSchema>;

type CardRow = { id: string; product_id: string; title: string; group_name: "FOOD" | "DRINK"; type_name: string;
  prompt_text: string; usage_tips: string; sort_order: number; active: boolean; image_key: string; image_mime: string };

function cardView(row: CardRow) {
  return { id: row.id, productId: row.product_id, title: row.title, group: row.group_name, typeName: row.type_name,
    promptText: row.prompt_text, usageTips: row.usage_tips, sortOrder: row.sort_order, active: row.active,
    imageUrl: `/api/admin/prompt-gallery/cards/${encodeURIComponent(row.id)}/image` };
}

export async function listAdminPromptGallery(selected?: string) {
  const collections = await query<{ product_id: string; name: string; description: string }>(
    "SELECT product_id,name,description FROM prompt_gallery_collection ORDER BY name");
  const chosen = selected || collections.rows[0]?.product_id || "";
  if (chosen && !collections.rows.some((row) => row.product_id === chosen)) throw new DomainError(404, "COLLECTION_NOT_FOUND", "Koleksi prompt tidak ditemukan.");
  const cards = chosen ? await query<CardRow>("SELECT * FROM prompt_gallery_card WHERE product_id=$1 ORDER BY sort_order,id", [chosen]) : { rows: [] };
  return { collections: collections.rows.map((row) => ({ productId: row.product_id, name: row.name, description: row.description })),
    selectedProductId: chosen, cards: cards.rows.map(cardView),
    eligibleProductIds: (process.env.PROMPT_GALLERY_PRODUCT_IDS || "").split(",").map((id) => id.trim()).filter(Boolean) };
}

export async function createPromptCollection(actor: Actor, value: unknown) {
  const parsed = collectionSchema.safeParse(value);
  if (!parsed.success) throw new DomainError(422, "INVALID_COLLECTION", "Isi ID produk, nama, dan deskripsi koleksi yang valid.");
  const input = parsed.data;
  return transaction(async (client) => {
    const result = await client.query("INSERT INTO prompt_gallery_collection(product_id,name,description) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING product_id",
      [input.productId, input.name, input.description]);
    if (!result.rowCount) throw new DomainError(409, "COLLECTION_EXISTS", "ID produk sudah dipakai koleksi lain.");
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'prompt_collection_created',$2,'admin_created')", [actor.id, input.productId]);
    return input;
  });
}

export async function parsePromptCardForm(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) throw new DomainError(415, "MULTIPART_REQUIRED", "Kirim formulir beserta gambar sebagai multipart/form-data.");
  const bytes = await readBody(request, MAX_PROMPT_IMAGE_BYTES + 128 * 1024);
  let form: FormData;
  try { form = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type")! }, body: bytes }).formData(); }
  catch { throw new DomainError(400, "INVALID_MULTIPART", "Format unggahan tidak valid."); }
  const fields = Object.fromEntries(["productId", "title", "group", "typeName", "promptText", "usageTips", "sortOrder", "active"].map((key) => [key, form.get(key)]));
  const parsed = cardSchema.safeParse(fields);
  if (!parsed.success) throw new DomainError(422, "INVALID_PROMPT_CARD", "Periksa produk, judul, style, isi prompt, tips, dan urutan.");
  const images = form.getAll("image");
  if (images.length > 1 || (images[0] !== undefined && typeof images[0] === "string")) throw new DomainError(422, "INVALID_PROMPT_IMAGE", "Pilih satu file gambar.");
  const image = images[0] as File | undefined;
  if (image && image.size > MAX_PROMPT_IMAGE_BYTES) throw new DomainError(413, "IMAGE_TOO_LARGE", "Gambar maksimal 8 MB.");
  return { input: parsed.data, image: image?.size ? new Uint8Array(await image.arrayBuffer()) : undefined };
}

export async function savePromptCard(actor: Actor, input: AdminCardInput, image?: Uint8Array, cardId?: string) {
  const collection = await query("SELECT 1 FROM prompt_gallery_collection WHERE product_id=$1", [input.productId]);
  if (!collection.rowCount) throw new DomainError(422, "COLLECTION_NOT_FOUND", "Buat koleksi produk terlebih dahulu.");
  const current = cardId ? await query<CardRow>("SELECT * FROM prompt_gallery_card WHERE id=$1", [cardId]) : undefined;
  if (cardId && !current?.rowCount) throw new DomainError(404, "PROMPT_NOT_FOUND", "Kartu prompt tidak ditemukan.");
  if (!image && !current) throw new DomainError(422, "PROMPT_IMAGE_REQUIRED", "Pilih gambar contoh untuk kartu baru.");
  const stored = image ? await storePromptImage(image) : { imageKey: current!.rows[0].image_key, mime: current!.rows[0].image_mime };
  return transaction(async (client) => {
    const id = cardId || `prompt_${randomUUID()}`;
    const values = [id, input.productId, input.title, input.group, input.typeName, input.promptText, input.usageTips,
      stored.imageKey, stored.mime, input.sortOrder, input.active];
    const result = cardId
      ? await client.query<CardRow>(`UPDATE prompt_gallery_card SET product_id=$2,title=$3,group_name=$4,type_name=$5,
        prompt_text=$6,usage_tips=$7,image_key=$8,image_mime=$9,sort_order=$10,active=$11,updated_at=NOW()
        WHERE id=$1 RETURNING *`, values)
      : await client.query<CardRow>(`INSERT INTO prompt_gallery_card(id,product_id,title,group_name,type_name,prompt_text,
        usage_tips,image_key,image_mime,sort_order,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, values);
    if (!result.rowCount) throw new DomainError(404, "PROMPT_NOT_FOUND", "Kartu prompt tidak ditemukan.");
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,$2,$3,'admin_editor')",
      [actor.id, cardId ? "prompt_card_updated" : "prompt_card_created", id]);
    return cardView(result.rows[0]);
  });
}

export async function deletePromptCard(actor: Actor, id: string) {
  return transaction(async (client) => {
    const result = await client.query("DELETE FROM prompt_gallery_card WHERE id=$1 RETURNING id", [id]);
    if (!result.rowCount) throw new DomainError(404, "PROMPT_NOT_FOUND", "Kartu prompt tidak ditemukan.");
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'prompt_card_deleted',$2,'admin_editor')", [actor.id, id]);
    return { id };
  });
}

export async function readAdminPromptImage(id: string) {
  const result = await query<Pick<CardRow, "image_key" | "image_mime">>("SELECT image_key,image_mime FROM prompt_gallery_card WHERE id=$1", [id]);
  if (!result.rowCount) throw new DomainError(404, "PROMPT_IMAGE_NOT_FOUND", "Gambar tidak ditemukan.");
  return readStoredPromptImage(result.rows[0].image_key, result.rows[0].image_mime);
}

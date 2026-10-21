import { query } from "./db";
import { type Actor, DomainError } from "./http";
import { readStoredPromptImage } from "./prompt-media";

type CardRow = {
  id: string; product_id: string; product_name: string; product_description: string;
  title: string; group_name: "FOOD" | "DRINK"; type_name: string;
  prompt_text: string; usage_tips: string; image_key: string; image_mime: string;
};

function accessSql() {
  return `c.active = true AND ($2::boolean OR EXISTS (
    SELECT 1 FROM access_grant g WHERE g.user_id = $1 AND g.product_id = c.product_id
      AND g.feature_key = 'prompt_gallery' AND g.status = 'active'
      AND (g.expires_at IS NULL OR g.expires_at > NOW())
  ))`;
}

function assertActive(actor: Actor) {
  if (actor.status !== "active") throw new DomainError(403, "ACCOUNT_PENDING", "Akun belum aktif.");
}

export async function listPromptGallery(actor: Actor) {
  assertActive(actor);
  const result = await query<CardRow>(`SELECT c.id,c.product_id,p.name AS product_name,p.description AS product_description,
    c.title,c.group_name,c.type_name,c.prompt_text,c.usage_tips,c.image_key,c.image_mime
    FROM prompt_gallery_card c JOIN prompt_gallery_collection p ON p.product_id=c.product_id
    WHERE ${accessSql()} ORDER BY p.name,c.sort_order,c.id`, [actor.id, actor.role === "admin"]);
  const collections = new Map<string, { productId: string; name: string; description: string; cards: Array<{
    id: string; title: string; group: "FOOD" | "DRINK"; typeName: string; promptText: string; usageTips: string; imageUrl: string;
  }> }>();
  for (const row of result.rows) {
    if (!collections.has(row.product_id)) collections.set(row.product_id, {
      productId: row.product_id, name: row.product_name, description: row.product_description, cards: [],
    });
    collections.get(row.product_id)!.cards.push({
      id: row.id, title: row.title, group: row.group_name, typeName: row.type_name,
      promptText: row.prompt_text, usageTips: row.usage_tips,
      imageUrl: `/api/prompts/${encodeURIComponent(row.id)}/image`,
    });
  }
  return { collections: [...collections.values()] };
}

export async function readPromptImage(actor: Actor, cardId: string) {
  assertActive(actor);
  const result = await query<Pick<CardRow, "image_key" | "image_mime">>(`SELECT c.image_key,c.image_mime
    FROM prompt_gallery_card c WHERE c.id=$3 AND ${accessSql()} LIMIT 1`,
  [actor.id, actor.role === "admin", cardId]);
  const row = result.rows[0];
  if (!row) {
    throw new DomainError(404, "PROMPT_IMAGE_NOT_FOUND", "Gambar tidak ditemukan.");
  }
  return readStoredPromptImage(row.image_key, row.image_mime);
}

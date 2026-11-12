import { query, transaction } from "./db";
import { DomainError } from "./http";
import type { LandingPageInput, LandingPageRecord } from "../lib/landing-builder";

type Row = { id: string; slug: string; title: string; seo_description: string; status: "draft" | "published"; meta_view_content_enabled: boolean; blocks: LandingPageInput["blocks"]; version: number; created_at: Date; updated_at: Date; published_at: Date | null };
const columns = "id,slug,title,seo_description,status,meta_view_content_enabled,blocks,version,created_at,updated_at,published_at";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function present(row: Row): LandingPageRecord {
  return { id: row.id, slug: row.slug, title: row.title, seoDescription: row.seo_description, status: row.status, metaViewContentEnabled: row.meta_view_content_enabled,
    blocks: row.blocks, version: row.version, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), publishedAt: row.published_at?.toISOString() ?? null };
}

export async function listLandingPages() {
  const result = await query<Pick<Row,"id"|"slug"|"title"|"status"|"version"|"updated_at">>("SELECT id,slug,title,status,version,updated_at FROM landing_page ORDER BY updated_at DESC LIMIT 100");
  return result.rows.map(row => ({ id: row.id, slug: row.slug, title: row.title, status: row.status, version: row.version, updatedAt: row.updated_at.toISOString() }));
}

export async function getLandingPage(id: string) {
  if (!uuidPattern.test(id)) throw new DomainError(404, "LANDING_NOT_FOUND", "Landing page tidak ditemukan.");
  const result = await query<Row>(`SELECT ${columns} FROM landing_page WHERE id=$1`, [id]);
  if (!result.rows[0]) throw new DomainError(404, "LANDING_NOT_FOUND", "Landing page tidak ditemukan.");
  return present(result.rows[0]);
}

export async function getPublishedLandingPage(slug: string) {
  if (!slugPattern.test(slug)) return null;
  const result = await query<Row>(`SELECT ${columns} FROM landing_page WHERE slug=$1 AND status='published'`, [slug]);
  return result.rows[0] ? present(result.rows[0]) : null;
}

export async function saveLandingPage(input: LandingPageInput, actorId: string, id?: string, expectedVersion?: number) {
  try {
    return await transaction(async client => {
      const result = id
        ? await client.query<Row>(`UPDATE landing_page SET slug=$2,title=$3,seo_description=$4,status=$5,blocks=$6,meta_view_content_enabled=$8,version=version+1,
            published_at=CASE WHEN $5='published' THEN COALESCE(published_at,now()) ELSE NULL END,updated_at=now()
            WHERE id=$1 AND version=$7 RETURNING ${columns}`,
            [id,input.slug,input.title,input.seoDescription,input.status,JSON.stringify(input.blocks),expectedVersion,input.metaViewContentEnabled])
        : await client.query<Row>(`INSERT INTO landing_page(slug,title,seo_description,status,blocks,meta_view_content_enabled,published_at)
            VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $4='published' THEN now() ELSE NULL END) RETURNING ${columns}`,
            [input.slug,input.title,input.seoDescription,input.status,JSON.stringify(input.blocks),input.metaViewContentEnabled]);
      if (!result.rows[0]) {
        const exists = await client.query("SELECT 1 FROM landing_page WHERE id=$1", [id]);
        throw new DomainError(exists.rowCount ? 409 : 404, exists.rowCount ? "LANDING_CONFLICT" : "LANDING_NOT_FOUND", exists.rowCount ? "Halaman sudah diubah di tab lain. Muat ulang sebelum menyimpan." : "Landing page tidak ditemukan.");
      }
      await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,$2,$3,$4)", [actorId,id ? "landing_page_updated" : "landing_page_created",result.rows[0].id,input.status]);
      return present(result.rows[0]);
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505")
      throw new DomainError(409, "LANDING_SLUG_TAKEN", "Slug landing page sudah digunakan.");
    throw error;
  }
}

export async function deleteLandingPage(id: string, expectedVersion: number, actorId: string) {
  if (!uuidPattern.test(id)) throw new DomainError(404, "LANDING_NOT_FOUND", "Landing page tidak ditemukan.");
  await transaction(async client => {
    const result = await client.query("DELETE FROM landing_page WHERE id=$1 AND version=$2 RETURNING id", [id,expectedVersion]);
    if (!result.rowCount) {
      const exists = await client.query("SELECT 1 FROM landing_page WHERE id=$1", [id]);
      throw new DomainError(exists.rowCount ? 409 : 404, exists.rowCount ? "LANDING_CONFLICT" : "LANDING_NOT_FOUND", exists.rowCount ? "Halaman sudah diubah. Muat ulang sebelum menghapus." : "Landing page tidak ditemukan.");
    }
    await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'landing_page_deleted',$2,'admin')", [actorId,id]);
  });
}

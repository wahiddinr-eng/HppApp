import { NextResponse } from "next/server.js";
import { databaseConfigured, query } from "./db";

export class DomainError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors?: Record<string, string>,public retryAfter=60) { super(message); }
}

export const apiError = (error: unknown) => {
  if (error instanceof DomainError) return NextResponse.json({ code: error.code, message: error.message, field_errors: error.fieldErrors }, { status: error.status, headers: { "Cache-Control": "private, no-store",...(error.status===429?{"Retry-After":String(error.retryAfter)}:{}) } });
  console.error("API error", error instanceof Error ? error.constructor.name : "unknown");
  return NextResponse.json({ code: "INTERNAL_ERROR", message: "Terjadi gangguan server. Coba lagi." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
};

export function checkConfigured() {
  if (!databaseConfigured()) throw new DomainError(503, "BACKEND_NOT_CONFIGURED", "Backend belum dikonfigurasi.");
}

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(process.env.APP_BASE_URL || "http://localhost:3000").origin) throw new DomainError(403, "INVALID_ORIGIN", "Asal permintaan tidak diizinkan.");
}

export async function readJson(request: Request, maxBytes = 256 * 1024): Promise<unknown> {
  const bytes = await readBody(request,maxBytes);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new DomainError(400, "INVALID_JSON", "Format JSON tidak valid."); }
}
export async function readBody(request:Request,maxBytes=256*1024) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new DomainError(413, "BODY_TOO_LARGE", "Ukuran permintaan terlalu besar.");
  const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let total=0;
  if(reader) while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw new DomainError(413,"BODY_TOO_LARGE","Ukuran permintaan terlalu besar.");}chunks.push(value);}
  const result=new Uint8Array(total);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}

export type Actor = { id: string; email: string; name: string; status: string; role: string; businessName: string | null };

export async function requireActor(request: Request, access: "session" | "calculator" | "admin" = "calculator"): Promise<Actor> {
  checkConfigured();
  const {auth}=await import("./auth");
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new DomainError(401, "UNAUTHENTICATED", "Silakan masuk terlebih dahulu.");
  const row = await query<{ account_status: string; role: string; business_name: string | null;display_name:string }>("SELECT account_status, role, business_name,display_name FROM user_profile WHERE user_id = $1", [session.user.id]);
  const profile = row.rows[0];
  if (!profile) throw new DomainError(403, "ACCOUNT_NOT_PROVISIONED", "Akun belum memiliki profil akses.");
  if (profile.account_status === "suspended" && access !== "session") throw new DomainError(403, "ACCOUNT_SUSPENDED", "Akun sedang ditangguhkan.");
  if (access === "admin" && profile.role !== "admin") throw new DomainError(403, "ADMIN_REQUIRED", "Akses admin diperlukan.");
  if (access === "calculator") {
    if (profile.account_status !== "active") throw new DomainError(403, "ACCOUNT_PENDING", "Akun belum diaktifkan.");
    const grant = await query("SELECT 1 FROM access_grant WHERE user_id = $1 AND feature_key = 'hpp_calculator' AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1", [session.user.id]);
    if (!grant.rowCount) throw new DomainError(403, "ACCESS_INACTIVE", "Akses kalkulator belum aktif.");
  }
  return { id: session.user.id, email: session.user.email, name: profile.display_name||session.user.name, status: profile.account_status, role: profile.role, businessName: profile.business_name };
}

export const privateJson = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

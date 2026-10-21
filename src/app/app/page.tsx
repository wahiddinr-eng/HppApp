import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/server/db";
import { requireActor } from "@/server/http";
import { protectPage } from "@/server/page-access";

export default async function Page() {
  const unavailable = await protectPage("session");
  if (unavailable) return unavailable;
  const actor = await requireActor(new Request(process.env.APP_BASE_URL!, { headers: new Headers(await headers()) }), "session");
  if (actor.role === "admin") redirect("/admin");
  if (actor.status !== "active") redirect("/app/access");
  const guide = await query<{ guide_completed_at: Date | null }>("SELECT guide_completed_at FROM user_profile WHERE user_id=$1", [actor.id]);
  if (!guide.rows[0]?.guide_completed_at) redirect("/app/guide");
  const grants = await query<{ feature_key: string }>("SELECT DISTINCT feature_key FROM access_grant WHERE user_id=$1 AND status='active' AND (expires_at IS NULL OR expires_at > NOW())", [actor.id]);
  if (grants.rows.some((row) => row.feature_key === "hpp_calculator")) redirect("/app/calculations");
  if (grants.rows.some((row) => row.feature_key === "prompt_gallery")) redirect("/app/prompts");
  redirect("/app/access");
}

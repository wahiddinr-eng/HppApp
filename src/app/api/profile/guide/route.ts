import { query } from "@/server/db";
import { apiError, checkOrigin, privateJson, requireActor } from "@/server/http";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request, "session");
    const result = await query<{ guide_completed_at: Date }>(`UPDATE user_profile
      SET guide_completed_at=COALESCE(guide_completed_at, now()), updated_at=now()
      WHERE user_id=$1 AND role='user' RETURNING guide_completed_at`, [actor.id]);
    return privateJson({ guideCompletedAt: result.rows[0]?.guide_completed_at?.toISOString() ?? null });
  } catch (error) { return apiError(error); }
}

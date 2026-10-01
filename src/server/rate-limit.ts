import { createHash } from "node:crypto";
import { query } from "./db";
import { DomainError } from "./http";

export async function rateLimit(key: string, limit = 20, seconds = 60) {
  const bucket = createHash("sha256").update(key).digest("hex");
  const result = await query<{ hits: number;expires_at:Date }>(`INSERT INTO app_rate_limit(bucket,hits,expires_at) VALUES($1,1,now()+$2*interval '1 second')
    ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN app_rate_limit.expires_at<now() THEN 1 ELSE app_rate_limit.hits+1 END,
    expires_at=CASE WHEN app_rate_limit.expires_at<now() THEN now()+$2*interval '1 second' ELSE app_rate_limit.expires_at END RETURNING hits,expires_at`, [bucket,seconds]);
  if (result.rows[0].hits > limit) throw new DomainError(429,"RATE_LIMITED","Terlalu banyak permintaan. Coba lagi sebentar.",undefined,Math.max(1,Math.ceil((new Date(result.rows[0].expires_at).getTime()-Date.now())/1000)));
}

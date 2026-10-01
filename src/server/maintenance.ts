import {transaction} from "./db";
export async function maintainRetention(){
  await transaction(async client=>{
    await client.query("DELETE FROM app_rate_limit WHERE expires_at<now()-interval '1 day'");
    await client.query("UPDATE email_outbox SET payload=NULL,status='expired' WHERE expires_at<now() AND status IN ('pending','failed')");
    await client.query("UPDATE email_outbox SET payload=NULL WHERE status IN ('sent','cancelled','expired') AND payload IS NOT NULL");
    await client.query("UPDATE webhook_event SET payload=jsonb_build_object('purchase',jsonb_build_object('id',payload->'purchase'->>'id')) WHERE status IN ('processed','ignored') AND created_at<now()-interval '30 days' AND payload ? 'schema_version'");
    // Keep grant, purchase state, event IDs and body hashes; only diagnostic bodies are trimmed.
  });
}

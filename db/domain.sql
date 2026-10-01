CREATE TABLE IF NOT EXISTS user_profile (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  account_status text NOT NULL DEFAULT 'pending_activation' CHECK (account_status IN ('pending_activation','active','suspended')),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  display_name text NOT NULL DEFAULT '', business_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS access_grant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text REFERENCES "user"(id),
  feature_key text NOT NULL DEFAULT 'hpp_calculator', source text NOT NULL,
  purchase_id text NOT NULL, item_id text NOT NULL, product_id text NOT NULL,
  status text NOT NULL CHECK(status IN ('active','revoked')), expires_at timestamptz,
  reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source,purchase_id,item_id,feature_key)
);
CREATE INDEX IF NOT EXISTS grant_user_active ON access_grant(user_id,status);
CREATE TABLE IF NOT EXISTS purchase_state (
  source text NOT NULL, purchase_id text NOT NULL, state_version bigint NOT NULL,
  customer_email text NOT NULL, snapshot jsonb NOT NULL, snapshot_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(source,purchase_id)
);
CREATE TABLE IF NOT EXISTS webhook_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL, event_id text NOT NULL,
  body_hash text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending',
  stage text NOT NULL DEFAULT 'received', attempts integer NOT NULL DEFAULT 0,
  next_attempt timestamptz NOT NULL DEFAULT now(), last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  UNIQUE(source,event_id)
);
CREATE INDEX IF NOT EXISTS webhook_pending ON webhook_event(next_attempt) WHERE status IN ('pending','failed');
CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text REFERENCES "user"(id), kind text NOT NULL,
  dedup_key text NOT NULL UNIQUE, recipient text NOT NULL, payload jsonb,
  status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
  next_attempt timestamptz NOT NULL DEFAULT now(), expires_at timestamptz,
  provider_message_id text, last_error text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_pending ON email_outbox(next_attempt) WHERE status IN ('pending','failed');
CREATE TABLE IF NOT EXISTS account_token (
  token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id), kind text NOT NULL,
  expires_at timestamptz NOT NULL, consumed_at timestamptz, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_token_user ON account_token(user_id,kind);
CREATE TABLE IF NOT EXISTS calculation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL REFERENCES "user"(id),
  draft_input jsonb NOT NULL, draft_version integer NOT NULL DEFAULT 1,
  name text NOT NULL DEFAULT '', state text NOT NULL DEFAULT 'draft', latest_revision integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calculation_owner ON calculation(owner_id,archived,updated_at DESC);
CREATE TABLE IF NOT EXISTS calculation_revision (
  calculation_id uuid NOT NULL REFERENCES calculation(id), revision integer NOT NULL,
  input jsonb NOT NULL, result jsonb NOT NULL, schema_version text NOT NULL DEFAULT '1',
  formula_version text NOT NULL DEFAULT 'hpp-v1', created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(calculation_id,revision)
);
CREATE TABLE IF NOT EXISTS finalize_request (
  calculation_id uuid NOT NULL REFERENCES calculation(id), request_id uuid NOT NULL,
  draft_version integer NOT NULL, revision integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(calculation_id,request_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id text, action text NOT NULL,
  target text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_rate_limit (
  bucket text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS worker_health (
  name text PRIMARY KEY, last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION prevent_revision_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Final calculation revisions are immutable';
END;
$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='calculation_revision_immutable') THEN
    CREATE TRIGGER calculation_revision_immutable BEFORE UPDATE OR DELETE ON calculation_revision
      FOR EACH ROW EXECUTE FUNCTION prevent_revision_change();
  END IF;
END;
$$;

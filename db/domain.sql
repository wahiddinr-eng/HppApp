CREATE TABLE IF NOT EXISTS user_profile (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  account_status text NOT NULL DEFAULT 'pending_activation' CHECK (account_status IN ('pending_activation','active','suspended')),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  display_name text NOT NULL DEFAULT '', business_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS guide_completed_at timestamptz;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS phone text;
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
CREATE TABLE IF NOT EXISTS checkout_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
  price integer NOT NULL DEFAULT 125000 CHECK (price>0),
  compare_price integer NOT NULL DEFAULT 299000 CHECK (compare_price>price),
  enabled boolean NOT NULL DEFAULT false,
  bank_name text NOT NULL DEFAULT '', account_number text NOT NULL DEFAULT '', account_holder text NOT NULL DEFAULT '',
  qris_image_key text, qris_image_mime text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS promo_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS promo_limit integer NOT NULL DEFAULT 100 CHECK (promo_limit BETWEEN 1 AND 100000);
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS promo_campaign_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS promo_deadline timestamptz;
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS promo_name text NOT NULL DEFAULT '' CHECK (length(promo_name) <= 80);
INSERT INTO checkout_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS checkout_promo_campaign (
  id uuid PRIMARY KEY,
  name text NOT NULL DEFAULT '' CHECK (length(name) <= 80),
  quota_limit integer NOT NULL CHECK (quota_limit BETWEEN 1 AND 100000),
  deadline timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_by text REFERENCES "user"(id),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
INSERT INTO checkout_promo_campaign(id,name,quota_limit,deadline)
SELECT promo_campaign_id,promo_name,promo_limit,promo_deadline FROM checkout_settings WHERE id=1
ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS landing_testimonial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL CHECK (length(trim(customer_name)) BETWEEN 2 AND 100),
  business_name text NOT NULL DEFAULT '',
  quote text NOT NULL CHECK (length(trim(quote)) BETWEEN 10 AND 1000),
  consent_confirmed boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT published OR consent_confirmed)
);
CREATE INDEX IF NOT EXISTS landing_testimonial_public ON landing_testimonial(sort_order,created_at) WHERE published;
CREATE TABLE IF NOT EXISTS meta_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
  enabled boolean NOT NULL DEFAULT false,
  pixel_id text NOT NULL DEFAULT '',
  capi_token_ciphertext text,
  graph_api_version text NOT NULL DEFAULT 'v26.0',
  test_event_code text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  updated_by text REFERENCES "user"(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS checkout_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE, customer_name text NOT NULL, customer_email text NOT NULL,
  customer_phone text,
  meta_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_method text NOT NULL CHECK(payment_method IN ('qris','bank')),
  price integer NOT NULL CHECK(price>0), compare_price integer NOT NULL CHECK(compare_price>price),
  payment_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','failed','complete')),
  version integer NOT NULL DEFAULT 1, user_id text REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
ALTER TABLE checkout_order ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE checkout_order ADD COLUMN IF NOT EXISTS meta_context jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE checkout_order ADD COLUMN IF NOT EXISTS promo_campaign_id uuid;
CREATE INDEX IF NOT EXISTS checkout_order_promo ON checkout_order(promo_campaign_id,status) WHERE promo_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS checkout_order_created ON checkout_order(created_at DESC);
CREATE INDEX IF NOT EXISTS checkout_order_email ON checkout_order(customer_email);
CREATE TABLE IF NOT EXISTS admin_push_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_push_subscription_user ON admin_push_subscription(user_id);
CREATE TABLE IF NOT EXISTS admin_push_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES checkout_order(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES admin_push_subscription(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','failed','sent','expired')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE(order_id,subscription_id)
);
CREATE INDEX IF NOT EXISTS admin_push_job_pending ON admin_push_job(next_attempt,created_at) WHERE status IN ('pending','failed');
CREATE TABLE IF NOT EXISTS meta_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id text NOT NULL UNIQUE,
  event_name text NOT NULL CHECK(event_name IN ('ViewContent','InitiateCheckout','Purchase')),
  pixel_id text,
  test_event_code text NOT NULL DEFAULT '',
  order_id uuid REFERENCES checkout_order(id), event_time timestamptz NOT NULL,
  payload jsonb, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','failed','sent','expired','cancelled')),
  attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(),
  last_error text, sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE meta_event_outbox ADD COLUMN IF NOT EXISTS pixel_id text;
ALTER TABLE meta_event_outbox ADD COLUMN IF NOT EXISTS test_event_code text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS meta_event_outbox_pending ON meta_event_outbox(next_attempt,created_at) WHERE status IN ('pending','failed');
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
CREATE TABLE IF NOT EXISTS ingredient_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  unit text NOT NULL CHECK (unit IN ('g','kg','ml','liter','buah')),
  current_price numeric(20,6) NOT NULL CHECK (current_price > 0),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ingredient_catalog_owner_name ON ingredient_catalog(owner_id,lower(name));
CREATE TABLE IF NOT EXISTS ingredient_price_history (
  ingredient_id uuid NOT NULL REFERENCES ingredient_catalog(id) ON DELETE CASCADE,
  version integer NOT NULL, price numeric(20,6) NOT NULL CHECK (price > 0),
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(ingredient_id,version)
);
CREATE TABLE IF NOT EXISTS channel_price_settings (
  calculation_id uuid PRIMARY KEY REFERENCES calculation(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES "user"(id),
  settings jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS channel_price_settings_owner ON channel_price_settings(owner_id);
CREATE TABLE IF NOT EXISTS profit_target (
  owner_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  settings jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS daily_sales (
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  sale_date date NOT NULL,
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,sale_date)
);
CREATE INDEX IF NOT EXISTS daily_sales_owner_date ON daily_sales(owner_id,sale_date DESC);
CREATE TABLE IF NOT EXISTS prompt_gallery_collection (
  product_id text PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS prompt_gallery_card (
  id text PRIMARY KEY, product_id text NOT NULL REFERENCES prompt_gallery_collection(product_id) ON DELETE CASCADE,
  title text NOT NULL, group_name text NOT NULL CHECK (group_name IN ('FOOD','DRINK')),
  type_name text NOT NULL, prompt_text text NOT NULL, usage_tips text NOT NULL DEFAULT '',
  image_key text NOT NULL, image_mime text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prompt_gallery_card_product ON prompt_gallery_card(product_id,active,sort_order);
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

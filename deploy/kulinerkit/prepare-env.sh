#!/bin/sh
set -eu

# Run as root with only the seven required SMTP settings on stdin. Never
# transfer the complete local .env.local or reuse local auth/webhook secrets.
target_env=/etc/kulinerkit/kulinerkit.env
test ! -e "$target_env"

tmp_env=$(mktemp /etc/kulinerkit/.kulinerkit-env.XXXXXXXX)
trap 'rm -f "$tmp_env"' EXIT HUP INT TERM
umask 077
auth_secret=$(openssl rand -hex 48)
webhook_secret=$(openssl rand -hex 48)
smtp_lines=$(grep -E '^(EMAIL_FROM|SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_REQUIRE_TLS|SMTP_USER|SMTP_PASSWORD)=' /dev/stdin)

{
  printf '%s\n' \
    'APP_BASE_URL=https://hpp.lrmobileid.com' \
    'DATABASE_URL=postgresql://kulinerkit@/kulinerkit?host=/var/run/postgresql' \
    "AUTH_SECRET=$auth_secret" \
    'PURCHASE_SOURCE_ID=app.lrmobileid.com' \
    'ELIGIBLE_AI_FOOD_PRODUCT_IDS=prd_344a58e2-23f3-4c33-84d0-cf0f9c52f9d0' \
    'PROMPT_GALLERY_PRODUCT_IDS=prd_344a58e2-23f3-4c33-84d0-cf0f9c52f9d0' \
    'PROMPT_MEDIA_ROOT=/var/lib/kulinerkit/prompt-gallery' \
    'CHECKOUT_MEDIA_ROOT=/var/lib/kulinerkit/checkout'
  printf "PURCHASE_WEBHOOK_KEYS='%s'\n" "{\"primary\":{\"source\":\"app.lrmobileid.com\",\"secret\":\"$webhook_secret\"}}"
  for key in EMAIL_FROM SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_REQUIRE_TLS SMTP_USER SMTP_PASSWORD; do
    line=$(printf '%s\n' "$smtp_lines" | grep -m 1 "^${key}=") || {
      printf 'Missing required SMTP setting: %s\n' "$key" >&2
      exit 1
    }
    test "${line#*=}" != '' || {
      printf 'Empty required SMTP setting: %s\n' "$key" >&2
      exit 1
    }
    printf '%s\n' "$line"
  done
} > "$tmp_env"

chown root:kulinerkit "$tmp_env"
chmod 0640 "$tmp_env"
mv "$tmp_env" "$target_env"
trap - EXIT HUP INT TERM
printf 'Production environment installed at %s (secrets not displayed).\n' "$target_env"

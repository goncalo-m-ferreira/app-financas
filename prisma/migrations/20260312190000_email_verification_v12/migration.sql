-- Email verification V1.2.
-- Backfill note:
-- Existing users are marked as verified to avoid lockout during rollout.

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);

UPDATE "users"
SET "email_verified_at" = COALESCE("email_verified_at", NOW())
WHERE "email_verified_at" IS NULL;

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_verification_tokens_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_token_hash_key"
ON "email_verification_tokens"("token_hash");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_idx"
ON "email_verification_tokens"("user_id");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_token_state_idx"
ON "email_verification_tokens"("token_hash", "used_at", "expires_at");

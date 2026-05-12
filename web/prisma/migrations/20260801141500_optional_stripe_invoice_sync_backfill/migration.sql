-- Idempotent backfill when `20260506141600_stripe_invoice_sync_fields` conflicted or was skipped
-- (e.g. column added manually/out-of-band). PostgreSQL 11+ `IF NOT EXISTS`.
ALTER TABLE "ProjectStripeInvoice" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER;

ALTER TABLE "ProjectStripeInvoice" ADD COLUMN IF NOT EXISTS "nextPaymentAttemptAt" TIMESTAMP(3);

ALTER TABLE "ProjectStripeInvoice" ADD COLUMN IF NOT EXISTS "lastStripeErrorSummary" VARCHAR(500);

ALTER TABLE "ProjectStripeInvoice" ADD COLUMN IF NOT EXISTS "lastSyncedFromStripeAt" TIMESTAMP(3);

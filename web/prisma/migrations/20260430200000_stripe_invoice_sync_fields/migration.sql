-- Stripe invoice enrichment: attempts, retry schedule, last error excerpt, explicit sync watermark.
ALTER TABLE "ProjectStripeInvoice" ADD COLUMN "attemptCount" INTEGER,
ADD COLUMN "nextPaymentAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastStripeErrorSummary" VARCHAR(500),
ADD COLUMN "lastSyncedFromStripeAt" TIMESTAMP(3);

-- Persist Stripe Invoice.amount_paid + Invoice.total (minor units) for auditing / ops snapshots.
ALTER TABLE "ProjectStripeInvoice" ADD COLUMN "amountPaidCents" INTEGER,
ADD COLUMN "totalCents" INTEGER;

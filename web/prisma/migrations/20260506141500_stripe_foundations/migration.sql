-- AlterTable
ALTER TABLE "Project" ADD COLUMN "stripeCustomerId" TEXT;

CREATE UNIQUE INDEX "Project_stripeCustomerId_key" ON "Project"("stripeCustomerId");

-- CreateTable
CREATE TABLE "ProjectStripeInvoice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "hostedInvoiceUrl" TEXT,
    "invoiceNumber" TEXT,
    "amountDueCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStripeInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectStripeInvoice_stripeInvoiceId_key" ON "ProjectStripeInvoice"("stripeInvoiceId");

CREATE INDEX "ProjectStripeInvoice_projectId_idx" ON "ProjectStripeInvoice"("projectId");

ALTER TABLE "ProjectStripeInvoice" ADD CONSTRAINT "ProjectStripeInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "StripeInboundEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeInboundEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeInboundEvent_stripeEventId_key" ON "StripeInboundEvent"("stripeEventId");

-- DocuSign: linked envelopes per project + idempotent inbound Connect deliveries.
CREATE TABLE "ProjectDocuSignEnvelope" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "statusChangedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "lastWebhookEvent" TEXT,
    "producerNote" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocuSignEnvelope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectDocuSignEnvelope_envelopeId_key" ON "ProjectDocuSignEnvelope"("envelopeId");
CREATE INDEX "ProjectDocuSignEnvelope_projectId_idx" ON "ProjectDocuSignEnvelope"("projectId");

ALTER TABLE "ProjectDocuSignEnvelope" ADD CONSTRAINT "ProjectDocuSignEnvelope_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DocuSignInboundEvent" (
    "id" TEXT NOT NULL,
    "payloadHashSha256" TEXT NOT NULL,
    "envelopeId" TEXT,
    "eventType" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocuSignInboundEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocuSignInboundEvent_payloadHashSha256_key" ON "DocuSignInboundEvent"("payloadHashSha256");

CREATE INDEX "DocuSignInboundEvent_envelopeId_idx" ON "DocuSignInboundEvent"("envelopeId");

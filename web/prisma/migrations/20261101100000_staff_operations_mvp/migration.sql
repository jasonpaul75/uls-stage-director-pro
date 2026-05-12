-- CreateEnum
CREATE TYPE "StaffAvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "StaffTaxDocumentKind" AS ENUM ('W9', 'W2');

-- AlterEnum
ALTER TYPE "GlobalRole" ADD VALUE 'STAFF';

-- CreateTable
CREATE TABLE "ProjectStaffAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "duties" TEXT,
    "assignedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAvailabilityDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "StaffAvailabilityStatus" NOT NULL,
    "note" VARCHAR(500),

    CONSTRAINT "StaffAvailabilityDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTaxDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "StaffTaxDocumentKind" NOT NULL,
    "fileName" VARCHAR(420) NOT NULL,
    "contentType" VARCHAR(200) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" VARCHAR(520) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffTaxDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEventQuestionnaire" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "travelNotes" TEXT,
    "foodNotes" TEXT,
    "paymentNotes" TEXT,
    "otherNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffEventQuestionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExpenseLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" VARCHAR(240) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "incurredAt" TIMESTAMP(3),
    "memo" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectExpenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStaffAssignment_projectId_staffUserId_key" ON "ProjectStaffAssignment"("projectId", "staffUserId");

-- CreateIndex
CREATE INDEX "ProjectStaffAssignment_staffUserId_idx" ON "ProjectStaffAssignment"("staffUserId");

-- CreateIndex
CREATE INDEX "ProjectStaffAssignment_projectId_idx" ON "ProjectStaffAssignment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAvailabilityDay_userId_date_key" ON "StaffAvailabilityDay"("userId", "date");

-- CreateIndex
CREATE INDEX "StaffAvailabilityDay_userId_idx" ON "StaffAvailabilityDay"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTaxDocument_storageKey_key" ON "StaffTaxDocument"("storageKey");

-- CreateIndex
CREATE INDEX "StaffTaxDocument_userId_idx" ON "StaffTaxDocument"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffEventQuestionnaire_projectId_staffUserId_key" ON "StaffEventQuestionnaire"("projectId", "staffUserId");

-- CreateIndex
CREATE INDEX "StaffEventQuestionnaire_staffUserId_idx" ON "StaffEventQuestionnaire"("staffUserId");

-- CreateIndex
CREATE INDEX "ProjectExpenseLine_projectId_idx" ON "ProjectExpenseLine"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectStaffAssignment" ADD CONSTRAINT "ProjectStaffAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectStaffAssignment" ADD CONSTRAINT "ProjectStaffAssignment_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectStaffAssignment" ADD CONSTRAINT "ProjectStaffAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffAvailabilityDay" ADD CONSTRAINT "StaffAvailabilityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffTaxDocument" ADD CONSTRAINT "StaffTaxDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffEventQuestionnaire" ADD CONSTRAINT "StaffEventQuestionnaire_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffEventQuestionnaire" ADD CONSTRAINT "StaffEventQuestionnaire_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectExpenseLine" ADD CONSTRAINT "ProjectExpenseLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

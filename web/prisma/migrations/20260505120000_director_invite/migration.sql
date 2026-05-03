-- CreateTable
CREATE TABLE "DirectorInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DirectorInvite_tokenHash_key" ON "DirectorInvite"("tokenHash");

CREATE INDEX "DirectorInvite_projectId_idx" ON "DirectorInvite"("projectId");

CREATE INDEX "DirectorInvite_email_idx" ON "DirectorInvite"("email");

ALTER TABLE "DirectorInvite" ADD CONSTRAINT "DirectorInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectorInvite" ADD CONSTRAINT "DirectorInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

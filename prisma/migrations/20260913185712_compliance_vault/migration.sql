-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'missing',
    "ownerId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ext" TEXT,
    "contentType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'valid',
    "expiresAt" TIMESTAMP(3),
    "version" TEXT NOT NULL DEFAULT 'v1',
    "sizeBytes" INTEGER,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidTask" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "due" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionPack" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "manifest" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Requirement_cardId_sortOrder_idx" ON "Requirement"("cardId", "sortOrder");

-- CreateIndex
CREATE INDEX "Requirement_cardId_status_idx" ON "Requirement"("cardId", "status");

-- CreateIndex
CREATE INDEX "Requirement_ownerId_idx" ON "Requirement"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_cardId_name_key" ON "Requirement"("cardId", "name");

-- CreateIndex
CREATE INDEX "VaultDocument_tenantId_category_idx" ON "VaultDocument"("tenantId", "category");

-- CreateIndex
CREATE INDEX "VaultDocument_tenantId_expiresAt_idx" ON "VaultDocument"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "VaultDocument_tenantId_status_idx" ON "VaultDocument"("tenantId", "status");

-- CreateIndex
CREATE INDEX "VaultDocument_uploadedBy_idx" ON "VaultDocument"("uploadedBy");

-- CreateIndex
CREATE UNIQUE INDEX "VaultDocument_tenantId_storageKey_key" ON "VaultDocument"("tenantId", "storageKey");

-- CreateIndex
CREATE INDEX "BidTask_cardId_createdAt_idx" ON "BidTask"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "BidTask_cardId_done_idx" ON "BidTask"("cardId", "done");

-- CreateIndex
CREATE INDEX "BidTask_ownerId_idx" ON "BidTask"("ownerId");

-- CreateIndex
CREATE INDEX "SubmissionPack_cardId_createdAt_idx" ON "SubmissionPack"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "SubmissionPack_cardId_status_idx" ON "SubmissionPack"("cardId", "status");

-- CreateIndex
CREATE INDEX "SubmissionPack_generatedBy_idx" ON "SubmissionPack"("generatedBy");

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "WorkspaceCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultDocument" ADD CONSTRAINT "VaultDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidTask" ADD CONSTRAINT "BidTask_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "WorkspaceCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionPack" ADD CONSTRAINT "SubmissionPack_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "WorkspaceCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

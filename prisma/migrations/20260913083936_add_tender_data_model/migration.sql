-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "ocid" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'etenders',
    "sourceReleaseId" TEXT,
    "title" TEXT NOT NULL,
    "buyer" TEXT NOT NULL,
    "province" TEXT,
    "category" TEXT,
    "valueZar" DECIMAL(18,2),
    "description" TEXT,
    "compulsoryBriefing" BOOLEAN NOT NULL DEFAULT false,
    "briefingAt" TIMESTAMP(3),
    "briefingVenue" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closingAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastIngestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderDocument" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "name" TEXT NOT NULL,
    "docType" TEXT,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'etenders',
    "status" TEXT NOT NULL DEFAULT 'running',
    "cursor" TEXT,
    "releasesProcessed" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceCard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tender_ocid_key" ON "Tender"("ocid");

-- CreateIndex
CREATE INDEX "Tender_publishedAt_idx" ON "Tender"("publishedAt");

-- CreateIndex
CREATE INDEX "Tender_closingAt_id_idx" ON "Tender"("closingAt", "id");

-- CreateIndex
CREATE INDEX "Tender_buyer_idx" ON "Tender"("buyer");

-- CreateIndex
CREATE INDEX "Tender_province_idx" ON "Tender"("province");

-- CreateIndex
CREATE INDEX "Tender_category_idx" ON "Tender"("category");

-- CreateIndex
CREATE INDEX "Tender_source_sourceUpdatedAt_idx" ON "Tender"("source", "sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "TenderDocument_tenderId_idx" ON "TenderDocument"("tenderId");

-- CreateIndex
CREATE INDEX "TenderDocument_sourceDocumentId_idx" ON "TenderDocument"("sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "TenderDocument_tenderId_url_key" ON "TenderDocument"("tenderId", "url");

-- CreateIndex
CREATE INDEX "IngestRun_source_startedAt_idx" ON "IngestRun"("source", "startedAt");

-- CreateIndex
CREATE INDEX "IngestRun_status_startedAt_idx" ON "IngestRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "WorkspaceCard_tenantId_stage_idx" ON "WorkspaceCard"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "WorkspaceCard_tenantId_ownerId_idx" ON "WorkspaceCard"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "WorkspaceCard_tenderId_idx" ON "WorkspaceCard"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceCard_tenantId_tenderId_key" ON "WorkspaceCard"("tenantId", "tenderId");

-- AddForeignKey
ALTER TABLE "TenderDocument" ADD CONSTRAINT "TenderDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceCard" ADD CONSTRAINT "WorkspaceCard_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

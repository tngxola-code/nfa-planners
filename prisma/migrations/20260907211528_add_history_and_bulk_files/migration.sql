-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "client" TEXT NOT NULL,
    "location" TEXT,
    "province" TEXT,
    "category" TEXT,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "publishedDate" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "documentUrls" TEXT[],
    "estimatedValue" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "fitScore" INTEGER NOT NULL,
    "fitReason" TEXT,
    "hash" TEXT NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityHistory" (
    "id" TEXT NOT NULL,
    "opportunityHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardee" TEXT,
    "awardAmount" DOUBLE PRECISION,
    "awardCurrency" TEXT,
    "source" TEXT NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawData" JSONB,

    CONSTRAINT "OpportunityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyFile" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordCount" INTEGER NOT NULL,

    CONSTRAINT "MonthlyFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_hash_key" ON "Opportunity"("hash");

-- CreateIndex
CREATE INDEX "Opportunity_closingDate_idx" ON "Opportunity"("closingDate");

-- CreateIndex
CREATE INDEX "Opportunity_fitScore_idx" ON "Opportunity"("fitScore");

-- CreateIndex
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");

-- CreateIndex
CREATE INDEX "OpportunityHistory_opportunityHash_idx" ON "OpportunityHistory"("opportunityHash");

-- CreateIndex
CREATE INDEX "OpportunityHistory_status_idx" ON "OpportunityHistory"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyFile_fileUrl_key" ON "MonthlyFile"("fileUrl");

-- CreateTable
CREATE TABLE "AiReviewJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "selectedDocumentIds" JSONB NOT NULL,
    "score" INTEGER,
    "findings" JSONB,
    "missingDocuments" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiReviewJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiReviewJob_tenantId_requestedBy_createdAt_idx" ON "AiReviewJob"("tenantId", "requestedBy", "createdAt");

-- CreateIndex
CREATE INDEX "AiReviewJob_tenantId_cardId_createdAt_idx" ON "AiReviewJob"("tenantId", "cardId", "createdAt");

-- CreateIndex
CREATE INDEX "AiReviewJob_tenantId_status_createdAt_idx" ON "AiReviewJob"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiReviewJob_cardId_idx" ON "AiReviewJob"("cardId");

-- CreateIndex
CREATE INDEX "AiReviewJob_requestedBy_idx" ON "AiReviewJob"("requestedBy");

-- AddForeignKey
ALTER TABLE "AiReviewJob" ADD CONSTRAINT "AiReviewJob_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "WorkspaceCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

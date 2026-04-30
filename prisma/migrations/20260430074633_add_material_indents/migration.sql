-- CreateEnum
CREATE TYPE "MaterialIndentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PARTIALLY_ISSUED', 'ISSUED', 'CANCELLED');

-- AlterTable
ALTER TABLE "BudgetLine" ADD COLUMN     "materialId" TEXT;

-- AlterTable
ALTER TABLE "StockIssue" ADD COLUMN     "indentLineId" TEXT;

-- CreateTable
CREATE TABLE "MaterialIndent" (
    "id" TEXT NOT NULL,
    "indentNo" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "MaterialIndentStatus" NOT NULL DEFAULT 'DRAFT',
    "needsApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialIndent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIndentLine" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "requestedQty" DECIMAL(14,3) NOT NULL,
    "unitCostSnapshot" DECIMAL(12,4) NOT NULL,
    "isInBudget" BOOLEAN NOT NULL DEFAULT true,
    "reasonOutOfBudget" TEXT,
    "issuedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "MaterialIndentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndentNumberSequence" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "IndentNumberSequence_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialIndent_indentNo_key" ON "MaterialIndent"("indentNo");

-- CreateIndex
CREATE INDEX "MaterialIndent_status_idx" ON "MaterialIndent"("status");

-- CreateIndex
CREATE INDEX "MaterialIndent_projectId_status_idx" ON "MaterialIndent"("projectId", "status");

-- CreateIndex
CREATE INDEX "MaterialIndent_requestedById_idx" ON "MaterialIndent"("requestedById");

-- CreateIndex
CREATE INDEX "MaterialIndentLine_indentId_idx" ON "MaterialIndentLine"("indentId");

-- CreateIndex
CREATE INDEX "MaterialIndentLine_materialId_idx" ON "MaterialIndentLine"("materialId");

-- CreateIndex
CREATE INDEX "BudgetLine_projectId_materialId_idx" ON "BudgetLine"("projectId", "materialId");

-- CreateIndex
CREATE INDEX "StockIssue_indentLineId_idx" ON "StockIssue"("indentLineId");

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_indentLineId_fkey" FOREIGN KEY ("indentLineId") REFERENCES "MaterialIndentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIndent" ADD CONSTRAINT "MaterialIndent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIndent" ADD CONSTRAINT "MaterialIndent_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIndent" ADD CONSTRAINT "MaterialIndent_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIndentLine" ADD CONSTRAINT "MaterialIndentLine_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "MaterialIndent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIndentLine" ADD CONSTRAINT "MaterialIndentLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

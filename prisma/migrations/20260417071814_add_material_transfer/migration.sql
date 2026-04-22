-- CreateTable
CREATE TABLE "MaterialTransfer" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "fromProjectId" TEXT NOT NULL,
    "toProjectId" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitCostAtTransfer" DECIMAL(12,4) NOT NULL,
    "transferredById" TEXT NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialTransfer_fromProjectId_transferredAt_idx" ON "MaterialTransfer"("fromProjectId", "transferredAt");

-- CreateIndex
CREATE INDEX "MaterialTransfer_toProjectId_transferredAt_idx" ON "MaterialTransfer"("toProjectId", "transferredAt");

-- CreateIndex
CREATE INDEX "MaterialTransfer_materialId_transferredAt_idx" ON "MaterialTransfer"("materialId", "transferredAt");

-- AddForeignKey
ALTER TABLE "MaterialTransfer" ADD CONSTRAINT "MaterialTransfer_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTransfer" ADD CONSTRAINT "MaterialTransfer_fromProjectId_fkey" FOREIGN KEY ("fromProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTransfer" ADD CONSTRAINT "MaterialTransfer_toProjectId_fkey" FOREIGN KEY ("toProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTransfer" ADD CONSTRAINT "MaterialTransfer_transferredById_fkey" FOREIGN KEY ("transferredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

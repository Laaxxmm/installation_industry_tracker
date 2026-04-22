-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "billedValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "fileNo" TEXT,
ADD COLUMN     "poNumber" TEXT;

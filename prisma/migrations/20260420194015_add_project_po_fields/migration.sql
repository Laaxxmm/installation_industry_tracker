-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "adjBillableValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "poDate" TIMESTAMP(3),
ADD COLUMN     "poStatus" "POStatus",
ADD COLUMN     "projectDetails" TEXT,
ADD COLUMN     "response" TEXT,
ADD COLUMN     "workStatus" TEXT;

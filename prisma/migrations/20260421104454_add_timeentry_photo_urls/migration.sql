-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

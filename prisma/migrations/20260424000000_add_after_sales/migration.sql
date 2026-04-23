-- AlterEnum: extend InvoiceKind for AMC + service-call invoices
ALTER TYPE "InvoiceKind" ADD VALUE 'AMC_CONTRACT';
ALTER TYPE "InvoiceKind" ADD VALUE 'AMC_INSTALLMENT';
ALTER TYPE "InvoiceKind" ADD VALUE 'SERVICE_CALL';

-- CreateEnum
CREATE TYPE "AMCType" AS ENUM ('COMPREHENSIVE', 'NON_COMPREHENSIVE', 'LABOUR_ONLY');

-- CreateEnum
CREATE TYPE "AMCBillingMode" AS ENUM ('ANNUAL', 'INSTALLMENTS', 'PER_VISIT');

-- CreateEnum
CREATE TYPE "AMCStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'ON_HOLD', 'EXPIRED', 'CANCELLED', 'RENEWED');

-- CreateEnum
CREATE TYPE "AMCFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "AMCVisitStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceChannel" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'PORTAL', 'WALK_IN');

-- CreateEnum
CREATE TYPE "ServicePriority" AS ENUM ('P1', 'P2', 'P3', 'P4');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('LEAK', 'BURST', 'BLOCKAGE', 'PUMP_FAILURE', 'VALVE_FAILURE', 'SPRINKLER_HEAD', 'ELECTRICAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'VERIFIED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceCoverage" AS ENUM ('AMC', 'WARRANTY', 'GOODWILL', 'BILLABLE');

-- AlterTable: StockIssue — add nullable visit back-links
ALTER TABLE "StockIssue"
  ADD COLUMN "amcVisitId" TEXT,
  ADD COLUMN "serviceVisitId" TEXT;

-- A stock consumption is either for a preventive AMC visit or a reactive
-- service visit, never both. projectId remains required, so an AMC/service
-- visit's stock issue still attributes to the site's project.
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_visit_xor_chk"
  CHECK (NOT ("amcVisitId" IS NOT NULL AND "serviceVisitId" IS NOT NULL));

-- AlterTable: ClientInvoice — add nullable source-link columns
ALTER TABLE "ClientInvoice"
  ADD COLUMN "amcId" TEXT,
  ADD COLUMN "serviceIssueId" TEXT;

-- An invoice sources from at most one of the after-sales parents. projectId
-- remains required (existing behaviour); AMC/service invoices use the
-- contract's or ticket's projectId for that link.
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_source_xor_chk"
  CHECK (NOT ("amcId" IS NOT NULL AND "serviceIssueId" IS NOT NULL));

-- CreateTable
CREATE TABLE "AMC" (
    "id" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "AMCType" NOT NULL DEFAULT 'COMPREHENSIVE',
    "billingMode" "AMCBillingMode" NOT NULL DEFAULT 'ANNUAL',
    "status" "AMCStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "frequency" "AMCFrequency" NOT NULL DEFAULT 'QUARTERLY',
    "visitsPerYear" INTEGER NOT NULL DEFAULT 4,
    "annualValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxPct" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "parentAmcId" TEXT,
    "siteAddress" TEXT NOT NULL,
    "assetsCovered" JSONB NOT NULL,
    "exclusions" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AMC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AMCSLA" (
    "id" TEXT NOT NULL,
    "amcId" TEXT NOT NULL,
    "priority" "ServicePriority" NOT NULL,
    "responseHours" INTEGER NOT NULL,
    "resolutionHours" INTEGER NOT NULL,

    CONSTRAINT "AMCSLA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AMCVisit" (
    "id" TEXT NOT NULL,
    "amcId" TEXT NOT NULL,
    "visitNo" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" "AMCVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "assignedToUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "checklist" JSONB,
    "findings" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "geoLat" DECIMAL(9,6),
    "geoLng" DECIMAL(9,6),
    "partsUsed" JSONB,
    "notes" TEXT,
    "offlineClientOpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AMCVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceIssue" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amcId" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "reportedByPhone" TEXT,
    "channel" "ServiceChannel" NOT NULL DEFAULT 'PHONE',
    "siteAddress" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" "ServiceCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "ServicePriority" NOT NULL DEFAULT 'P3',
    "coverage" "ServiceCoverage" NOT NULL DEFAULT 'BILLABLE',
    "coverageOverrideReason" TEXT,
    "responseDueAt" TIMESTAMP(3),
    "resolutionDueAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "slaBreachedAt" TIMESTAMP(3),
    "onHoldSince" TIMESTAMP(3),
    "onHoldCumulativeMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "ServiceStatus" NOT NULL DEFAULT 'NEW',
    "assignedToUserId" TEXT,
    "triagedByUserId" TEXT,
    "triagedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "closureNotes" TEXT,
    "clientSignoffName" TEXT,
    "clientSignoffAt" TIMESTAMP(3),
    "billableAmount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVisit" (
    "id" TEXT NOT NULL,
    "serviceIssueId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "findings" TEXT,
    "workPerformed" TEXT,
    "partsUsed" JSONB,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "geoLat" DECIMAL(9,6),
    "geoLng" DECIMAL(9,6),
    "signatureUrl" TEXT,
    "offlineClientOpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AMCNumberSequence" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AMCNumberSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "ServiceTicketNumberSequence" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ServiceTicketNumberSequence_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "AMC_contractNo_key" ON "AMC"("contractNo");

-- CreateIndex
CREATE INDEX "AMC_status_idx" ON "AMC"("status");

-- CreateIndex
CREATE INDEX "AMC_clientId_startDate_idx" ON "AMC"("clientId", "startDate");

-- CreateIndex
CREATE INDEX "AMC_projectId_idx" ON "AMC"("projectId");

-- CreateIndex
CREATE INDEX "AMC_endDate_idx" ON "AMC"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "AMCSLA_amcId_priority_key" ON "AMCSLA"("amcId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "AMCVisit_amcId_visitNo_key" ON "AMCVisit"("amcId", "visitNo");

-- CreateIndex
CREATE UNIQUE INDEX "AMCVisit_offlineClientOpId_key" ON "AMCVisit"("offlineClientOpId");

-- CreateIndex
CREATE INDEX "AMCVisit_scheduledDate_status_idx" ON "AMCVisit"("scheduledDate", "status");

-- CreateIndex
CREATE INDEX "AMCVisit_assignedToUserId_status_idx" ON "AMCVisit"("assignedToUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceIssue_ticketNo_key" ON "ServiceIssue"("ticketNo");

-- CreateIndex
CREATE INDEX "ServiceIssue_status_priority_idx" ON "ServiceIssue"("status", "priority");

-- CreateIndex
CREATE INDEX "ServiceIssue_clientId_reportedAt_idx" ON "ServiceIssue"("clientId", "reportedAt");

-- CreateIndex
CREATE INDEX "ServiceIssue_projectId_idx" ON "ServiceIssue"("projectId");

-- CreateIndex
CREATE INDEX "ServiceIssue_assignedToUserId_status_idx" ON "ServiceIssue"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "ServiceIssue_resolutionDueAt_idx" ON "ServiceIssue"("resolutionDueAt");

-- CreateIndex
CREATE INDEX "ServiceIssue_slaBreachedAt_idx" ON "ServiceIssue"("slaBreachedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceVisit_offlineClientOpId_key" ON "ServiceVisit"("offlineClientOpId");

-- CreateIndex
CREATE INDEX "ServiceVisit_serviceIssueId_idx" ON "ServiceVisit"("serviceIssueId");

-- CreateIndex
CREATE INDEX "ServiceVisit_assignedToUserId_scheduledAt_idx" ON "ServiceVisit"("assignedToUserId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockIssue_amcVisitId_key" ON "StockIssue"("amcVisitId");

-- CreateIndex
CREATE UNIQUE INDEX "StockIssue_serviceVisitId_key" ON "StockIssue"("serviceVisitId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_serviceIssueId_key" ON "ClientInvoice"("serviceIssueId");

-- CreateIndex
CREATE INDEX "ClientInvoice_amcId_idx" ON "ClientInvoice"("amcId");

-- AddForeignKey
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_amcVisitId_fkey" FOREIGN KEY ("amcVisitId") REFERENCES "AMCVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_amcId_fkey" FOREIGN KEY ("amcId") REFERENCES "AMC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_serviceIssueId_fkey" FOREIGN KEY ("serviceIssueId") REFERENCES "ServiceIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMC" ADD CONSTRAINT "AMC_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMC" ADD CONSTRAINT "AMC_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMC" ADD CONSTRAINT "AMC_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMC" ADD CONSTRAINT "AMC_parentAmcId_fkey" FOREIGN KEY ("parentAmcId") REFERENCES "AMC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMCSLA" ADD CONSTRAINT "AMCSLA_amcId_fkey" FOREIGN KEY ("amcId") REFERENCES "AMC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMCVisit" ADD CONSTRAINT "AMCVisit_amcId_fkey" FOREIGN KEY ("amcId") REFERENCES "AMC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMCVisit" ADD CONSTRAINT "AMCVisit_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_amcId_fkey" FOREIGN KEY ("amcId") REFERENCES "AMC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_triagedByUserId_fkey" FOREIGN KEY ("triagedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceIssue" ADD CONSTRAINT "ServiceIssue_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_serviceIssueId_fkey" FOREIGN KEY ("serviceIssueId") REFERENCES "ServiceIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'CHANGES_REQUESTED', 'REVISED', 'NEGOTIATING', 'ACCEPTED', 'CONVERTED', 'LOST', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuoteEventKind" AS ENUM ('SENT', 'CLIENT_VIEWED', 'ALTERATION_REQUESTED', 'CUSTOMIZATION_REQUESTED', 'NEGOTIATION', 'REVISION_ISSUED', 'ACCEPTED', 'REJECTED', 'NOTE');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectStageKey" AS ENUM ('SURVEY', 'DELIVERY', 'INSTALL', 'COMMISSION', 'HANDOVER');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('ADVANCE', 'PROGRESS', 'FINAL', 'ADHOC');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "billingAddress" TEXT NOT NULL,
    "shippingAddress" TEXT,
    "stateCode" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNo" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentQuoteId" TEXT,
    "validUntil" TIMESTAMP(3),
    "placeOfSupplyStateCode" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "termsMd" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "shareToken" TEXT NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "hsnSac" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gstRatePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(14,2) NOT NULL,
    "lineTax" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteEvent" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "kind" "QuoteEventKind" NOT NULL,
    "note" TEXT,
    "fromStatus" "QuoteStatus",
    "toStatus" "QuoteStatus",
    "actorUserId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNo" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedByUserId" TEXT,
    "signedAt" TIMESTAMP(3),
    "clientPoNumber" TEXT,
    "clientPoDate" TIMESTAMP(3),
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageKey" "ProjectStageKey" NOT NULL,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageKey" "ProjectStageKey" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "percentComplete" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "placeOfSupplyStateCode" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "termsMd" TEXT,
    "poRef" TEXT,
    "createdById" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "hsnSac" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gstRatePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(14,2) NOT NULL,
    "lineTax" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ClientInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteNumberSequence" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "QuoteNumberSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "PONumberSequence" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PONumberSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "ClientInvoiceNumberSequence" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ClientInvoiceNumberSequence_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Client_active_idx" ON "Client"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_gstin_key" ON "Client"("name", "gstin");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNo_key" ON "Quote"("quoteNo");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_projectId_key" ON "Quote"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_shareToken_key" ON "Quote"("shareToken");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_clientId_idx" ON "Quote"("clientId");

-- CreateIndex
CREATE INDEX "Quote_createdAt_idx" ON "Quote"("createdAt");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_sortOrder_idx" ON "QuoteLine"("quoteId", "sortOrder");

-- CreateIndex
CREATE INDEX "QuoteEvent_quoteId_at_idx" ON "QuoteEvent"("quoteId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNo_key" ON "PurchaseOrder"("poNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_projectId_key" ON "PurchaseOrder"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_quoteId_key" ON "PurchaseOrder"("quoteId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStage_projectId_stageKey_key" ON "ProjectStage"("projectId", "stageKey");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_stageKey_sortOrder_idx" ON "ProjectMilestone"("projectId", "stageKey", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_invoiceNo_key" ON "ClientInvoice"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_shareToken_key" ON "ClientInvoice"("shareToken");

-- CreateIndex
CREATE INDEX "ClientInvoice_projectId_issuedAt_idx" ON "ClientInvoice"("projectId", "issuedAt");

-- CreateIndex
CREATE INDEX "ClientInvoice_status_idx" ON "ClientInvoice"("status");

-- CreateIndex
CREATE INDEX "ClientInvoice_clientId_idx" ON "ClientInvoice"("clientId");

-- CreateIndex
CREATE INDEX "ClientInvoiceLine_invoiceId_sortOrder_idx" ON "ClientInvoiceLine"("invoiceId", "sortOrder");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_parentQuoteId_fkey" FOREIGN KEY ("parentQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_signedByUserId_fkey" FOREIGN KEY ("signedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoiceLine" ADD CONSTRAINT "ClientInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

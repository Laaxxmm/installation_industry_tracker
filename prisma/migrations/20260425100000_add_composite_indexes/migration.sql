-- Composite indexes to speed up dashboard / reports / ai-sweep hot paths.
-- ClientInvoice: dashboard groups by (status, issuedAt) for AR aging; invoices list
-- orders by createdAt DESC across 500+ rows.
CREATE INDEX "ClientInvoice_status_issuedAt_idx" ON "ClientInvoice"("status", "issuedAt");
CREATE INDEX "ClientInvoice_createdAt_idx" ON "ClientInvoice"("createdAt");

-- ServiceIssue: ai-sweep filters open tickets by (status NOT IN [...], resolutionDueAt >= now).
CREATE INDEX "ServiceIssue_status_resolutionDueAt_idx" ON "ServiceIssue"("status", "resolutionDueAt");

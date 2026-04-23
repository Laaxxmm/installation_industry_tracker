# SAB India — Sales Pipeline, Project Progress & GST Invoicing

## Context

The v1 tracker (already built) captures cost and P&L **after** a project is won — but gives no visibility **before**. Today SAB's sales team has no system for quoting new jobs, tracking negotiation rounds, or converting accepted quotes into kickoff paperwork; and on the billing side, invoicing is just a manual DB row with no GST breakdown and no PDF to send clients. This phase closes those gaps end-to-end:

- **Quote lifecycle**: build a quote with line items → share PDF → track revisions/negotiation → convert to project.
- **On conversion**: auto-issue an internal Work Order (PO) and auto-seed the project budget from quote lines.
- **Project progress**: high-level stages + fine-grained milestones with % complete, over-due alerts.
- **GST-compliant invoicing**: line-itemised tax invoices with CGST/SGST/IGST math, PDFs, and shareable download links. Manual-only recurrence per user request (existing `createInvoice` flow upgraded, no cron).

Builds on the existing stack (Next.js App Router + Prisma + PostgreSQL + NextAuth + decimal.js + exceljs + Sapphire design system). Reuses: `db`, `requireRole`/`requireSession`, `formatINR`, `formatIST`, `Decimal`, `AuditLog`, `PageHeader`/`StatCard`/`StatusBadge`/`Card` primitives, `nextProjectCode`-style sequence pattern, `src/app/api/export/[kind]/route.ts` streaming pattern.

---

## 1. New dependencies

```
npm i @react-pdf/renderer
```

That's it. No email SDK (download + share link only), no cron library (manual invoicing only), no new UI libs (reuse Sapphire primitives).

---

## 2. Data model additions (`prisma/schema.prisma`)

**Conventions carry over**: money = `Decimal(14,2)`; tax rates = `Decimal(5,2)`; qty = `Decimal(12,3)`; timestamps `timestamptz`; IST grouping via `date-fns-tz`.

**New enums:**
- `QuoteStatus { DRAFT, SENT, CHANGES_REQUESTED, REVISED, NEGOTIATING, ACCEPTED, CONVERTED, LOST, EXPIRED }`
- `QuoteEventKind { SENT, CLIENT_VIEWED, ALTERATION_REQUESTED, CUSTOMIZATION_REQUESTED, NEGOTIATION, REVISION_ISSUED, ACCEPTED, REJECTED, NOTE }`
- `QuoteLineCategory { MATERIAL, LABOR, OTHER }` (maps 1:1 to existing `BudgetCategory` on conversion)
- `InvoiceKind { ADVANCE, PROGRESS, FINAL, ADHOC }`
- `InvoiceStatus { DRAFT, ISSUED, PAID, CANCELLED }`
- `ProjectStageKey { SURVEY, DELIVERY, INSTALL, COMMISSION, HANDOVER }` (fixed 5 stages)
- `MilestoneStatus { PENDING, IN_PROGRESS, DONE, BLOCKED }`
- `POStatus { DRAFT, ISSUED, CANCELLED }`

**New models:**

- **Client** — `id, name, gstin?, pan?, billingAddress, shippingAddress?, stateCode (2-digit GST state, e.g. "29" for Karnataka), contactName?, email?, phone?, active, createdAt`. Unique `(name, gstin)` when gstin present. Index `(name)`.
- **Quote** — `id, quoteNo (unique, SAB-Q-YYYY-####), clientId, projectId? (set after conversion), title, status, version (int, default 1), parentQuoteId? (for revisions — links v2 back to v1), validUntil?, placeOfSupplyStateCode, subtotal, taxTotal, grandTotal, notes?, termsMd?, createdById, createdAt, sentAt?, acceptedAt?, convertedAt?, shareToken (unique, random 32-byte hex)`. Index `(status)`, `(clientId)`, `(createdAt desc)`.
- **QuoteLine** — `id, quoteId CASCADE, sortOrder, category, description, hsnSac?, quantity, unit ("nos"/"m"/"kg"/...), unitPrice, discountPct (default 0), gstRatePct (0/5/12/18/28), lineSubtotal, lineTax, lineTotal`. Index `(quoteId, sortOrder)`.
- **QuoteEvent** — `id, quoteId CASCADE, kind, note?, fromStatus?, toStatus?, actorUserId? (null when client-triggered via share link), at`. Powers the audit/activity timeline. Index `(quoteId, at desc)`.
- **PurchaseOrder** — `id, poNo (unique, SAB-WO-YYYY-####), projectId unique, quoteId unique, status, issuedAt, signedByUserId?, signedAt?, clientPoNumber?, clientPoDate?, plannedStart, plannedEnd, amount, snapshotJson (frozen copy of quote lines + client block at issue time)`. The WO is a 1:1 twin of a converted quote.
- **ProjectStage** — `id, projectId CASCADE, stageKey, plannedStart?, plannedEnd?, actualStart?, actualEnd?, notes?`. Unique `(projectId, stageKey)`. Stages auto-seeded on project create (5 rows, PENDING).
- **ProjectMilestone** — `id, projectId CASCADE, stageKey (parent stage), sortOrder, name, plannedStart?, plannedEnd?, percentComplete (Decimal(5,2), 0–100), weight (Decimal(6,2), default 1), status, updatedByUserId?, updatedAt`. Index `(projectId, stageKey, sortOrder)`.
- **ClientInvoice** — new model for GST-compliant invoicing. `id, invoiceNo (unique, SAB-INV-YYYY-####), kind, status, projectId, clientId, placeOfSupplyStateCode, issuedAt, dueAt?, subtotal, cgst, sgst, igst, taxTotal, grandTotal, amountPaid (default 0), paidAt?, notes?, termsMd?, poRef? (poNo or clientPoNumber), createdById, shareToken (unique)`. Index `(projectId, issuedAt desc)`, `(status)`.
- **ClientInvoiceLine** — `id, invoiceId CASCADE, sortOrder, description, hsnSac?, quantity, unit, unitPrice, discountPct, gstRatePct, lineSubtotal, lineTax, lineTotal`. Index `(invoiceId, sortOrder)`.

**Existing model changes:**
- `Project` gains `clientId Int?` (nullable to preserve existing rows) + relation. Old `clientName` stays; on conversion we set both.
- Keep the legacy `Invoice` model in place for v1 overhead/revenue rows; all **new** client-facing invoices use `ClientInvoice`. The P&L engine sums revenue from **both** `Invoice.amount` and `ClientInvoice.grandTotal` in range.
- Add `QuoteNumberSequence`, `PONumberSequence`, `ClientInvoiceNumberSequence` (parallel to existing `ProjectCodeSequence`).

**Cascade choices:** QuoteLine/QuoteEvent cascade on Quote delete (before it's CONVERTED — after conversion, deletion is blocked). ClientInvoiceLine cascades on ClientInvoice delete (DRAFT only; ISSUED is Restrict). PurchaseOrder is Restrict — WOs are permanent audit records.

---

## 3. GST math (`src/lib/gst.ts`)

Pure Decimal functions, fully unit-tested. No floats.

- `computeLine({ quantity, unitPrice, discountPct, gstRatePct }) → { subtotal, tax, total }`
  - `base = quantity × unitPrice × (1 − discountPct/100)`
  - `tax = base × gstRatePct/100`
  - `total = base + tax`
- `summarise(lines, { supplierStateCode, placeOfSupplyStateCode }) → { subtotal, cgst, sgst, igst, taxTotal, grandTotal, gstBreakdown: Array<{ratePct, taxable, cgst, sgst, igst}> }`
  - If `supplierStateCode === placeOfSupplyStateCode` (intra-state): CGST = SGST = tax/2; IGST = 0.
  - Else (inter-state): IGST = tax; CGST = SGST = 0.
- Supplier state read from `env.SAB_STATE_CODE` (default `"29"` Karnataka). Place of supply on each Quote/ClientInvoice defaults to client's `stateCode`, user-editable.
- All amounts rounded to 2 dp with `Decimal.ROUND_HALF_UP` at the line boundary; grand total is the straight sum (no second rounding).

Helpers reused: `src/lib/money.ts::formatINR`, `toDecimal`; no changes needed.

---

## 4. Progress math (`src/lib/progress.ts`)

- `projectPercentComplete(milestones) = Σ(m.percentComplete × m.weight) / Σ(m.weight)` (Decimal). `0` when no milestones.
- `stagePercentComplete(stageMilestones)` = same formula, filtered.
- `isOverdue(milestone, now) = m.status !== DONE && m.plannedEnd && m.plannedEnd < now`.
- Stage auto-advance rules (informational only; manual override always allowed):
  - Stage becomes `IN_PROGRESS` when any child milestone has `percentComplete > 0`.
  - Stage `actualEnd` auto-set when all child milestones reach 100%.

---

## 5. Modules

### 5.1 Clients (`/clients`)
Routes: `/clients` (list + new), `/clients/[id]` (detail with quote history + invoice history + project history).
Actions (`src/server/actions/clients.ts`): `createClient`, `updateClient`, `archiveClient`. RBAC: ADMIN/MANAGER create+edit; SUPERVISOR read-only.

### 5.2 Quotes (`/quotes`)
Routes:
- `/quotes` — list with status filter, aging, grand total column.
- `/quotes/new` — multi-step form: pick client → header (title, validUntil, place of supply) → line editor (category, description, HSN/SAC, qty, unit, unitPrice, discount%, GST%) → live totals panel → save DRAFT.
- `/quotes/[id]` — hub with tabs: **Overview** (client, totals, status, validUntil), **Lines** (edit while DRAFT/REVISED; frozen once SENT until a revision), **Activity** (QuoteEvent timeline with kind-coloured dots), **Preview** (embedded PDF), **Share** (copy public link).
- `/quotes/[id]/revise` — creates v2 with `parentQuoteId` pointing to v1, copies lines, sets status REVISED. v1 stays historical.
- **Public share view** `/q/[token]` (unauthenticated, route in `src/app/(public)/q/[token]/page.tsx`) — renders the quote as a branded HTML page + "Download PDF" button. Viewing emits a `CLIENT_VIEWED` QuoteEvent (rate-limited, once per day per token).

Actions (`src/server/actions/quotes.ts`): `createQuote`, `upsertQuoteLine`, `deleteQuoteLine`, `sendQuote` (DRAFT → SENT, generates shareToken if null, logs event), `recordAlteration/Customization/Negotiation` (adds QuoteEvent + moves status → CHANGES_REQUESTED), `reviseQuote` (clones to v2), `acceptQuote` (→ ACCEPTED, prompts conversion), `markLost`, `expireStaleQuotes` (run on-demand from a button, not cron — scans for `SENT && validUntil < now` and flips to EXPIRED).

Conversion — `convertQuoteToProject(quoteId, input)` in `src/server/actions/quotes.ts`:
1. RBAC: MANAGER+.
2. In a single `$transaction`:
   - Create `Project` (reuse existing `nextProjectCode`) with `clientId`, `contractValue = quote.grandTotal`, `startDate/endDate` from input, `status = ACTIVE`.
   - Seed `ProjectStage` rows (5, all PENDING).
   - Copy each `QuoteLine` → `BudgetLine`: map `category` 1:1, `description`, `quantity`, `unitCost = unitPrice × (1 − discount/100)`, `total = lineSubtotal` (ex-tax, since budgets are cost not price — see note below).
   - Create `PurchaseOrder` with `snapshotJson` = deep clone of quote+lines+client, `amount = grandTotal`, `status = ISSUED`, new `poNo` from sequence.
   - Update Quote: `status = CONVERTED`, `projectId`, `convertedAt`.
   - Log `QuoteEvent { kind: ACCEPTED, toStatus: CONVERTED }` + one `AuditLog` per write.
3. `revalidatePath` for `/quotes`, `/projects`, `/projects/[id]`.

> **Note on budget seeding:** Quote `unitPrice` is what we charge the client; project `BudgetLine.unitCost` represents what we expect it to cost us. Seeding the budget from price isn't strictly correct, but it's a defensible v1 starting point — managers overwrite with true cost before the project runs. The alternative (capturing `estimatedCost` per quote line) is a v2 refinement.

### 5.3 Purchase Orders / Work Orders (`/projects/[id]/po`)
Generated on conversion — not manually created. Detail page shows WO header, signed-by, client PO ref fields (editable by MANAGER+), lines (read-only snapshot), `Download PDF`. `signPO(poId)` action = MANAGER+ clicks "Mark signed", stamps `signedAt` + `signedByUserId`. Re-issue disabled — only one WO per project.

### 5.4 Project progress (`/projects/[id]/progress`)
New tab added to existing `ProjectTabs` client component (alongside Overview/Budget/Materials/P&L/Ledger). Page shows:
- **Stage strip** — 5-stage horizontal progress bar with planned/actual dates and % complete per stage.
- **Milestone list** — grouped by stage; each row has name, planned/actual dates, % slider (0/25/50/75/100 quick buttons + numeric input), status pill, weight, last updated.
- **Over-due callout** — red banner listing any milestones where `plannedEnd < now && status !== DONE`.
- **Overall % complete** in the project hub's StatCard strip.

Actions (`src/server/actions/progress.ts`): `upsertMilestone`, `deleteMilestone`, `updateMilestonePercent` (the hot path — supervisor-friendly), `updateStageDates`. RBAC: SUPERVISOR+ on own project; MANAGER+ anywhere.

### 5.5 Client invoicing (`/invoices`)
Routes:
- `/invoices` — list with status filter, client filter, kind filter, grand total, paid flag.
- `/invoices/new` — form: pick project (client auto-filled) → kind → place of supply → lines (can seed from unbilled PO remainder: `grandTotal − Σ issued ClientInvoices`) → DRAFT.
- `/invoices/[id]` — hub: Overview | Lines | Preview | Share. DRAFT is fully editable; ISSUED is frozen. Actions: `issueInvoice` (DRAFT → ISSUED, assigns invoiceNo from sequence, generates shareToken, logs audit), `markPaid(amount, paidAt)`, `cancelInvoice` (ISSUED → CANCELLED; requires reason).
- Public share `/i/[token]` — unauthenticated invoice view + PDF download, mirrors quote share page.

Actions (`src/server/actions/client-invoices.ts`): `createClientInvoice`, `upsertInvoiceLine`, `deleteInvoiceLine`, `issueInvoice`, `markPaid`, `cancelInvoice`.

> **Existing `Invoice` model** kept intact for back-compat; `/overhead` continues to use it. We do **not** migrate the old table — old rows stay as revenue entries. Going forward, client-facing invoices use the new `ClientInvoice` flow. The P&L `getProjectPnl`/`getPortfolioPnl` revenue sum becomes `Σ Invoice.amount + Σ ClientInvoice.grandTotal where status IN (ISSUED, PAID)` for the range. Update in `src/server/actions/pnl.ts`.

---

## 6. PDF pipeline (`src/server/pdf/`)

Library: **@react-pdf/renderer**. Files:
- `src/server/pdf/shared.tsx` — `Styles` (Sapphire-tinted: `#0B5CAD` accents, slate borders, 10pt body, 9pt tables), `CompanyHeader` component (logo block + SAB address + GSTIN placeholder from env), `ClientBlock`, `GstSummaryTable`, `SignatureBlock`, `footerNote(pageNumber, totalPages)`.
- `src/server/pdf/quote-pdf.tsx` — `<QuoteDocument quote={...} lines={...} client={...} />` returning `<Document><Page>...</Page></Document>`. Shows header (quote no, version, valid until, place of supply), client block, terms, line table with HSN/qty/rate/disc/taxable/GST%/tax/total, totals panel, GST summary grouped by rate, signature block.
- `src/server/pdf/po-pdf.tsx` — `<PurchaseOrderDocument po={...} snapshot={...} />` uses `snapshotJson`. Shows internal WO heading, project code, client PO ref, timeline (plannedStart → plannedEnd), line schedule, signed-by block.
- `src/server/pdf/invoice-pdf.tsx` — `<TaxInvoiceDocument invoice={...} lines={...} client={...} project={...} />`. "TAX INVOICE" heading, invoiceNo, issue + due date, place of supply, IRN placeholder, GST breakdown (CGST/SGST/IGST as applicable), amount-in-words (`src/lib/amount-in-words.ts` — small utility using Indian numbering system), bank details block from env.

API routes stream the PDF via `@react-pdf/renderer`'s `renderToStream`:
- `GET /api/pdf/quote/[id]` — auth required (session), enforces RBAC.
- `GET /api/pdf/po/[id]` — auth required.
- `GET /api/pdf/invoice/[id]` — auth required.
- `GET /api/pdf/public/quote/[token]` — no auth; validates shareToken; stamps `CLIENT_VIEWED` event on quote.
- `GET /api/pdf/public/invoice/[token]` — no auth; validates shareToken.

All routes set `Content-Type: application/pdf` + `Content-Disposition: inline; filename="..."`. Mirror the existing `src/app/api/export/[kind]/route.ts` streaming style.

**Share link security**: `shareToken` is a 32-byte random hex string generated with `crypto.randomBytes(32)`, indexed and unique. Tokens don't expire in v1 (acceptable per "Download + share link only"). Revocation: rotating `shareToken` via a `rotateShareToken(quoteId|invoiceId)` action invalidates old links immediately.

---

## 7. Nav + RBAC

**Nav pills** (add in `src/app/(dashboard)/layout.tsx`):
- `/clients` — ADMIN, MANAGER, SUPERVISOR (read-only for SUPERVISOR)
- `/quotes` — ADMIN, MANAGER
- `/invoices` — ADMIN, MANAGER
- Project detail tabs gain **Progress** and **Work Order** alongside Overview/Budget/Materials/P&L/Ledger.

**Middleware gates** (`src/middleware.ts`):
- `/clients` — authenticated
- `/quotes`, `/invoices`, `/projects/[id]/po` — MANAGER+
- Public `/q/[token]`, `/i/[token]`, `/api/pdf/public/**` — unauthenticated (token is the capability).

**RBAC helpers** (`src/server/rbac.ts`) — add:
- `canEditQuote(session, quote)` — author or MANAGER+; only while DRAFT/REVISED/CHANGES_REQUESTED.
- `canIssueInvoice(session)` — MANAGER+.
- `canUpdateProgressFor(session, projectId)` — same rule as existing `canBookConsumptionFor`.

Every new server action starts with one of these checks, same pattern as v1.

---

## 8. Critical files

### New
- `prisma/schema.prisma` — model additions listed in §2 + sequence tables + migration.
- `src/lib/gst.ts` + `tests/unit/gst.test.ts`
- `src/lib/progress.ts` + `tests/unit/progress.test.ts`
- `src/lib/amount-in-words.ts` + `tests/unit/amount-in-words.test.ts`
- `src/server/actions/clients.ts`
- `src/server/actions/quotes.ts`
- `src/server/actions/client-invoices.ts`
- `src/server/actions/progress.ts`
- `src/server/actions/purchase-orders.ts`
- `src/server/pdf/shared.tsx`, `quote-pdf.tsx`, `po-pdf.tsx`, `invoice-pdf.tsx`
- `src/app/api/pdf/quote/[id]/route.ts`, `po/[id]/route.ts`, `invoice/[id]/route.ts`
- `src/app/api/pdf/public/quote/[token]/route.ts`, `public/invoice/[token]/route.ts`
- `src/app/(dashboard)/clients/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
- `src/app/(dashboard)/quotes/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/revise/page.tsx`, plus client components `QuoteLineEditor.tsx`, `QuoteActivity.tsx`, `ConvertQuoteDialog.tsx`
- `src/app/(dashboard)/invoices/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, plus `InvoiceLineEditor.tsx`
- `src/app/(dashboard)/projects/[id]/po/page.tsx`
- `src/app/(dashboard)/projects/[id]/progress/page.tsx`, plus `MilestoneRow.tsx`, `StageStrip.tsx`
- `src/app/(public)/q/[token]/page.tsx`, `src/app/(public)/i/[token]/page.tsx`

### Modified
- `src/app/(dashboard)/layout.tsx` — add Clients, Quotes, Invoices nav pills.
- `src/app/(dashboard)/projects/[id]/ProjectTabs.tsx` — add Progress, Work Order tabs.
- `src/server/actions/pnl.ts` — include `ClientInvoice.grandTotal` in revenue sum.
- `src/server/rbac.ts` — add helpers listed in §7.
- `src/middleware.ts` — add gates listed in §7.
- `prisma/seed.ts` — seed one Client, one sample Quote (DRAFT), and 5 stage rows per existing project.

### Env additions
- `SAB_STATE_CODE` (e.g. `"29"`)
- `SAB_GSTIN` (shown on PDFs)
- `SAB_ADDRESS`, `SAB_BANK_DETAILS`, `SAB_LOGO_URL` (optional; fallback to text-only header if unset)

---

## 9. Phased delivery

1. **Schema + sequences + migrations** — Prisma models, run `prisma migrate dev`, seed updates. Verify existing data intact.
2. **Clients module** — CRUD, list, detail. Backfill `Project.clientId` by fuzzy-match on `clientName` (manual review UI in `/admin`, or SQL script; low-risk since nullable).
3. **GST engine + progress engine** — `lib/gst.ts`, `lib/progress.ts`, `lib/amount-in-words.ts` with full Vitest coverage. No UI yet.
4. **Quotes module (CRUD + activity)** — `/quotes` list, new, detail, line editor, activity timeline, revisions. Skip PDF + share.
5. **PDF pipeline + public share** — `server/pdf/*`, 5 API routes, public `/q/[token]` and `/i/[token]` pages, rotate-token action.
6. **Quote → project conversion + WO** — `convertQuoteToProject`, `/projects/[id]/po`, PO PDF.
7. **Progress module** — stage seeding on project create, `/projects/[id]/progress`, dashboard over-due surface, project hub `Progress` stat.
8. **Client invoicing** — `/invoices` CRUD, DRAFT→ISSUED flow, markPaid, PDF + share, P&L revenue integration.
9. **Hardening** — RBAC audit (every new action re-reviewed), Playwright E2E extension (§10), index + query-plan pass, deploy.

---

## 10. Verification

### Unit (Vitest)
- `tests/unit/gst.test.ts`
  - Intra-state 18% line: qty=2, unit=1000, disc=10% → subtotal 1800, CGST 162, SGST 162, total 2124.
  - Inter-state 18% same inputs: IGST 324, CGST=SGST=0.
  - Mixed rates (5% + 18%) summarise: grouped GST breakdown rows, grand total = Σ lineTotal.
  - Zero-rated (0%) line: tax=0, total=base.
  - Rounding edge: unit=100.01, qty=3, disc=7.5%, 18% GST → no drift at grand total.
- `tests/unit/progress.test.ts`
  - Weighted avg with mixed weights (1, 2, 1) and mixed % (100, 50, 0) → 50%.
  - All-zero milestones → 0%; no milestones → 0%.
  - `isOverdue`: DONE+past = false; IN_PROGRESS+past = true.
- `tests/unit/amount-in-words.test.ts`
  - ₹1,19,100 → "Rupees One Lakh Nineteen Thousand One Hundred Only".
  - ₹2.50 paise → "Rupees Two and Fifty Paise Only".
  - Indian numbering boundaries (lakh, crore).

### E2E (Playwright, extends existing golden path)
1. Manager creates Client "KMC Hospital, Manipal" (GSTIN 29AAACK0000A1Z5, stateCode 29).
2. Manager creates Quote `SAB-Q-2026-0001` for that client: 2 lines (cable 50m @ ₹120 + install kit 1 @ ₹25,000, both 18% GST). Expected subtotal 31,000; CGST 2,790; SGST 2,790; grand total 36,580.
3. Send quote → status SENT, shareToken assigned. Open `/q/[token]` in a fresh (unauth) context; verify PDF downloads and `CLIENT_VIEWED` event logged.
4. Record Alteration ("swap cable for 6sqmm") → CHANGES_REQUESTED. Click Revise → v2 created with `parentQuoteId = v1.id`, v1 frozen.
5. Edit v2 (unitPrice for cable → ₹150 → subtotal 32,500; grand 38,350). Send → SENT. Accept → ACCEPTED.
6. Convert → Project `SAB-2026-00XX` created with clientId, contractValue 38,350, 5 ProjectStage rows seeded, 2 BudgetLines seeded (MATERIAL 6,000+23,728.81 ex-tax). Quote v2 → CONVERTED with projectId set. WO `SAB-WO-2026-0001` issued with snapshotJson. WO PDF downloads.
7. Supervisor opens `/projects/[id]/progress` → updates 2 milestones (Site survey 100%, Delivery 50%). Overall % = weighted avg displayed on project hub.
8. Manager creates ClientInvoice (ADVANCE 30%, grand ₹11,505), issues → invoiceNo `SAB-INV-2026-0001`, share link works, PDF downloads. Mark paid.
9. Re-read project P&L: revenue = 11,505 (from new ClientInvoice) + any legacy Invoice rows; contribution + net P&L compute correctly including GST-exclusive vs inclusive handling.
10. Export portfolio XLSX — revenue column includes ClientInvoice total.

This scenario doubles as the UAT demo for the sales pipeline rollout.

---

## 11. Explicit non-goals (v1 of this phase)

- **No email sending.** Share link + download only; manual forwarding.
- **No recurring invoices.** Manual per-invoice creation only. (Can revisit if AMC volume grows.)
- **No e-signature.** WO "signed" is just a timestamp + user stamp.
- **No e-invoicing / IRN portal integration.** PDF carries an IRN placeholder field that can be filled manually post-generation.
- **No payment gateway.** `markPaid` is a manual status flip.
- **No quote discount-approval workflow.** Any MANAGER+ can set any discount. Could be added later via a `requiresApprovalIf(discount > X%)` hook.

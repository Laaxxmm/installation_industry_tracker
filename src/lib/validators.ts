import { z } from "zod";

export const decimalString = z.union([z.string(), z.number()]).transform((v) => String(v));

export const ProjectInput = z.object({
  name: z.string().min(2).max(120),
  clientName: z.string().min(1).max(120),
  contractValue: decimalString,
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  siteSupervisorId: z.string().nullable().optional(),
  poDate: z.string().datetime().nullable().optional(),
  poStatus: z.enum(["DRAFT", "ISSUED", "CANCELLED"]).nullable().optional(),
  poNumber: z.string().max(80).nullable().optional(),
  fileNo: z.string().max(40).nullable().optional(),
  location: z.string().max(240).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  projectDetails: z.string().max(4000).nullable().optional(),
  workStatus: z.string().max(120).nullable().optional(),
  billedValue: decimalString.optional(),
  adjBillableValue: decimalString.optional(),
  response: z.string().max(2000).nullable().optional(),
});
export type ProjectInput = z.infer<typeof ProjectInput>;

export const BudgetLineInput = z.object({
  id: z.string().optional(),
  projectId: z.string(),
  category: z.enum(["MATERIAL", "LABOR", "OTHER"]),
  description: z.string().min(1),
  // Optional binding to a Material SKU — only meaningful when
  // category === "MATERIAL". When set, indents for that material count
  // against this line's quantity for the in-budget check.
  materialId: z.string().nullable().optional(),
  quantity: decimalString,
  unitCost: decimalString,
});
export type BudgetLineInput = z.infer<typeof BudgetLineInput>;

export const PunchInInput = z.object({
  projectId: z.string(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});
export type PunchInInput = z.infer<typeof PunchInInput>;

export const UserInput = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(100),
  role: z.enum(["ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"]),
  employmentType: z.enum(["HOURLY", "SALARIED"]).nullable().optional(),
});
export type UserInput = z.infer<typeof UserInput>;

export const RateCardInput = z.object({
  userId: z.string(),
  type: z.enum(["HOURLY", "SALARIED"]),
  hourlyRate: decimalString.nullable().optional(),
  monthlySalary: decimalString.nullable().optional(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable().optional(),
});
export type RateCardInput = z.infer<typeof RateCardInput>;

export const MaterialInput = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(20),
});
export type MaterialInput = z.infer<typeof MaterialInput>;

export const StockReceiptInput = z.object({
  materialId: z.string(),
  qty: decimalString,
  unitCost: decimalString,
  supplier: z.string().max(120).optional(),
  receivedAt: z.string().datetime(),
  note: z.string().max(500).optional(),
});
export type StockReceiptInput = z.infer<typeof StockReceiptInput>;

export const StockIssueInput = z.object({
  materialId: z.string(),
  projectId: z.string(),
  qty: decimalString,
  issuedAt: z.string().datetime(),
  note: z.string().max(500).optional(),
});
export type StockIssueInput = z.infer<typeof StockIssueInput>;

export const MaterialTransferInput = z
  .object({
    materialId: z.string(),
    fromProjectId: z.string(),
    toProjectId: z.string(),
    qty: decimalString,
    transferredAt: z.string().datetime(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => v.fromProjectId !== v.toProjectId, {
    message: "From and To projects must differ",
    path: ["toProjectId"],
  });
export type MaterialTransferInput = z.infer<typeof MaterialTransferInput>;

export const DirectPurchaseInput = z.object({
  projectId: z.string(),
  description: z.string().min(1).max(200),
  qty: decimalString,
  unitCost: decimalString,
  supplier: z.string().max(120).optional(),
  purchasedAt: z.string().datetime(),
  invoiceRef: z.string().max(50).optional(),
  category: z.enum(["MATERIAL", "OTHER"]).default("MATERIAL"),
});
export type DirectPurchaseInput = z.infer<typeof DirectPurchaseInput>;

export const OverheadInput = z.object({
  projectId: z.string(),
  periodMonth: z.string().datetime(),
  amount: decimalString,
  note: z.string().max(500).optional(),
});
export type OverheadInput = z.infer<typeof OverheadInput>;

export const InvoiceInput = z.object({
  projectId: z.string(),
  invoiceNo: z.string().min(1).max(50),
  amount: decimalString,
  issuedAt: z.string().datetime(),
  note: z.string().max(500).optional(),
});
export type InvoiceInput = z.infer<typeof InvoiceInput>;

// ---------- Clients ----------

const STATE_CODE = z
  .string()
  .regex(/^\d{2}$/, "State code must be a 2-digit GST code");
const GSTIN = z
  .string()
  .regex(
    /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d$/,
    "GSTIN must be 15 characters: 2 digits + 5 letters + 4 digits + 1 letter + 1 digit + 1 letter + 1 digit",
  );

export const ClientInput = z.object({
  name: z.string().min(1).max(200),
  gstin: z.union([GSTIN, z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  pan: z
    .union([z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  billingAddress: z.string().min(1).max(500),
  shippingAddress: z.string().max(500).optional(),
  stateCode: STATE_CODE,
  contactName: z.string().max(120).optional(),
  email: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  phone: z.string().max(30).optional(),
  notes: z.string().max(1000).optional(),
});
export type ClientInput = z.infer<typeof ClientInput>;

// ---------- Quote ----------

export const QuoteLineInput = z.object({
  id: z.string().optional(),
  category: z.enum(["MATERIAL", "LABOR", "OTHER"]),
  description: z.string().min(1).max(500),
  hsnSac: z.string().max(20).optional(),
  quantity: decimalString,
  unit: z.string().min(1).max(20),
  unitPrice: decimalString,
  discountPct: decimalString.default("0"),
  gstRatePct: decimalString.default("0"),
});
export type QuoteLineInput = z.infer<typeof QuoteLineInput>;

export const QuoteHeaderInput = z.object({
  clientId: z.string(),
  title: z.string().min(1).max(200),
  validUntil: z.string().datetime().nullable().optional(),
  placeOfSupplyStateCode: STATE_CODE,
  notes: z.string().max(2000).optional(),
  termsMd: z.string().max(5000).optional(),
});
export type QuoteHeaderInput = z.infer<typeof QuoteHeaderInput>;

export const QuoteCreateInput = QuoteHeaderInput.extend({
  lines: z.array(QuoteLineInput).default([]),
});
export type QuoteCreateInput = z.infer<typeof QuoteCreateInput>;

export const ConvertQuoteInput = z.object({
  quoteId: z.string(),
  projectName: z.string().min(2).max(200),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  siteSupervisorId: z.string().nullable().optional(),
});
export type ConvertQuoteInput = z.infer<typeof ConvertQuoteInput>;

// ---------- Progress ----------

export const MilestoneInput = z.object({
  id: z.string().optional(),
  projectId: z.string(),
  stageKey: z.enum(["SURVEY", "DELIVERY", "INSTALL", "COMMISSION", "HANDOVER"]),
  sortOrder: z.number().int().min(0).default(0),
  name: z.string().min(1).max(200),
  plannedStart: z.string().datetime().nullable().optional(),
  plannedEnd: z.string().datetime().nullable().optional(),
  weight: decimalString.default("1"),
});
export type MilestoneInput = z.infer<typeof MilestoneInput>;

export const MilestonePercentInput = z.object({
  milestoneId: z.string(),
  percentComplete: decimalString,
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"]).optional(),
});
export type MilestonePercentInput = z.infer<typeof MilestonePercentInput>;

export const StageDatesInput = z.object({
  projectId: z.string(),
  stageKey: z.enum(["SURVEY", "DELIVERY", "INSTALL", "COMMISSION", "HANDOVER"]),
  plannedStart: z.string().datetime().nullable().optional(),
  plannedEnd: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).optional(),
});
export type StageDatesInput = z.infer<typeof StageDatesInput>;

// ---------- Client invoice (GST) ----------

export const ClientInvoiceLineInput = z.object({
  id: z.string().optional(),
  description: z.string().min(1).max(500),
  hsnSac: z.string().max(20).optional(),
  quantity: decimalString,
  unit: z.string().min(1).max(20),
  unitPrice: decimalString,
  discountPct: decimalString.default("0"),
  gstRatePct: decimalString.default("0"),
});
export type ClientInvoiceLineInput = z.infer<typeof ClientInvoiceLineInput>;

export const ClientInvoiceCreateInput = z.object({
  projectId: z.string(),
  kind: z.enum(["ADVANCE", "PROGRESS", "FINAL", "ADHOC"]),
  placeOfSupplyStateCode: STATE_CODE,
  dueAt: z.string().datetime().nullable().optional(),
  poRef: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  termsMd: z.string().max(5000).optional(),
  lines: z.array(ClientInvoiceLineInput).default([]),
});
export type ClientInvoiceCreateInput = z.infer<typeof ClientInvoiceCreateInput>;

export const POUpdateInput = z.object({
  poId: z.string(),
  clientPoNumber: z.string().max(80).optional(),
  clientPoDate: z.string().datetime().nullable().optional(),
  plannedStart: z.string().datetime().optional(),
  plannedEnd: z.string().datetime().optional(),
});
export type POUpdateInput = z.infer<typeof POUpdateInput>;

// ---------- Procurement (Vendors, Vendor POs, GRNs, Vendor bills) ----------

const VENDOR_CATEGORY = z.enum([
  "PIPES",
  "FITTINGS",
  "PUMPS",
  "VALVES",
  "SPRINKLERS",
  "TOOLS",
  "CONSUMABLES",
  "SERVICES",
  "OTHER",
]);

const VENDOR_PAYMENT_TERMS = z.enum([
  "NET_15",
  "NET_30",
  "NET_45",
  "NET_60",
  "ADVANCE",
]);

export const VendorInput = z.object({
  name: z.string().min(1).max(200),
  gstin: z.union([GSTIN, z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  pan: z
    .union([z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  stateCode: STATE_CODE,
  category: VENDOR_CATEGORY.default("OTHER"),
  msme: z.boolean().default(false),
  contactName: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  email: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  address: z.string().max(500).optional(),
  paymentTerms: VENDOR_PAYMENT_TERMS.default("NET_30"),
  creditLimit: decimalString.default("0"),
  notes: z.string().max(1000).optional(),
});
export type VendorInput = z.infer<typeof VendorInput>;

export const VendorPOLineInput = z.object({
  sku: z.string().min(1).max(60),
  description: z.string().min(1).max(300),
  unit: z.string().min(1).max(20),
  quantity: decimalString,
  unitPrice: decimalString,
  gstRatePct: decimalString.default("18"),
});
export type VendorPOLineInput = z.infer<typeof VendorPOLineInput>;

export const VendorPOCreateInput = z.object({
  vendorId: z.string(),
  projectId: z.string().nullable().optional(),
  expectedDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(VendorPOLineInput).min(1, "At least one line is required"),
});
export type VendorPOCreateInput = z.infer<typeof VendorPOCreateInput>;

export const GRNLineInput = z.object({
  poLineId: z.string(),
  acceptedQty: decimalString,
  rejectedQty: decimalString.default("0"),
  reason: z.string().max(500).optional(),
});
export type GRNLineInput = z.infer<typeof GRNLineInput>;

export const GRNCreateInput = z.object({
  poId: z.string(),
  receivedAt: z.string().datetime(),
  notes: z.string().max(1000).optional(),
  lines: z.array(GRNLineInput).min(1, "At least one line is required"),
});
export type GRNCreateInput = z.infer<typeof GRNCreateInput>;

export const VendorBillLineInput = z.object({
  description: z.string().min(1).max(300),
  unit: z.string().min(1).max(20),
  quantity: decimalString,
  unitPrice: decimalString,
  gstRatePct: decimalString.default("18"),
});
export type VendorBillLineInput = z.infer<typeof VendorBillLineInput>;

export const VendorBillCreateInput = z.object({
  vendorId: z.string(),
  poId: z.string().nullable().optional(),
  vendorBillNo: z.string().max(80).optional(),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(VendorBillLineInput).min(1, "At least one line is required"),
});
export type VendorBillCreateInput = z.infer<typeof VendorBillCreateInput>;

// ---------- After-sales (AMC + Service Issues) ----------

const AMC_TYPE = z.enum(["COMPREHENSIVE", "NON_COMPREHENSIVE", "LABOUR_ONLY"]);
const AMC_BILLING_MODE = z.enum(["ANNUAL", "INSTALLMENTS", "PER_VISIT"]);
const AMC_FREQUENCY = z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"]);
const SERVICE_PRIORITY = z.enum(["P1", "P2", "P3", "P4"]);
const SERVICE_CHANNEL = z.enum(["PHONE", "WHATSAPP", "EMAIL", "PORTAL", "WALK_IN"]);
const SERVICE_CATEGORY = z.enum([
  "LEAK",
  "BURST",
  "BLOCKAGE",
  "PUMP_FAILURE",
  "VALVE_FAILURE",
  "SPRINKLER_HEAD",
  "ELECTRICAL",
  "GENERAL",
]);
const SERVICE_COVERAGE = z.enum(["AMC", "WARRANTY", "GOODWILL", "BILLABLE"]);

export const AMCSLAInput = z.object({
  priority: SERVICE_PRIORITY,
  responseHours: z.number().int().min(1).max(24 * 30),
  resolutionHours: z.number().int().min(1).max(24 * 60),
});
export type AMCSLAInput = z.infer<typeof AMCSLAInput>;

const ASSET_LINE = z.object({
  name: z.string().min(1).max(200),
  qty: z.number().int().min(1).optional(),
  notes: z.string().max(500).optional(),
});

export const AMCInput = z
  .object({
    title: z.string().min(1).max(200),
    clientId: z.string(),
    projectId: z.string(),
    type: AMC_TYPE.default("COMPREHENSIVE"),
    billingMode: AMC_BILLING_MODE.default("ANNUAL"),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    frequency: AMC_FREQUENCY.default("QUARTERLY"),
    visitsPerYear: z.number().int().min(1).max(52),
    annualValue: decimalString,
    taxPct: decimalString.default("18"),
    siteAddress: z.string().min(1).max(500),
    assetsCovered: z.array(ASSET_LINE).min(1, "List at least one covered asset"),
    exclusions: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
    slas: z.array(AMCSLAInput).min(1, "Define SLA for at least one priority"),
  })
  .refine(
    (v) => new Date(v.endDate).getTime() > new Date(v.startDate).getTime(),
    { message: "End date must be after start date", path: ["endDate"] },
  )
  .refine(
    (v) => {
      const perYear = { MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, YEARLY: 1 }[v.frequency];
      return v.visitsPerYear === perYear;
    },
    { message: "visitsPerYear must match frequency (QUARTERLY→4, etc.)", path: ["visitsPerYear"] },
  );
export type AMCInput = z.infer<typeof AMCInput>;

const PART_LINE = z.object({
  sku: z.string().max(60).optional(),
  description: z.string().min(1).max(200),
  qty: decimalString,
  unit: z.string().min(1).max(20),
});

const CHECKLIST_ITEM = z.object({
  item: z.string().min(1).max(200),
  ok: z.boolean(),
  note: z.string().max(500).optional(),
});

export const AMCVisitCompleteInput = z.object({
  findings: z.string().max(4000).optional(),
  partsUsed: z.array(PART_LINE).optional(),
  photoUrls: z.array(z.string().url()).default([]),
  geoLat: z.number().min(-90).max(90).optional(),
  geoLng: z.number().min(-180).max(180).optional(),
  checklist: z.array(CHECKLIST_ITEM).optional(),
  notes: z.string().max(2000).optional(),
  billableAmount: decimalString.optional(),
  offlineClientOpId: z.string().uuid().optional(),
});
export type AMCVisitCompleteInput = z.infer<typeof AMCVisitCompleteInput>;

export const ServiceIssueCreateInput = z.object({
  clientId: z.string(),
  projectId: z.string(),
  amcId: z.string().nullable().optional(),
  reportedAt: z.string().datetime(),
  reportedByName: z.string().min(1).max(120),
  reportedByPhone: z.string().max(30).optional(),
  channel: SERVICE_CHANNEL,
  siteAddress: z.string().min(1).max(500),
  summary: z.string().min(5).max(200),
  description: z.string().max(4000).optional(),
  attachmentUrls: z.array(z.string().url()).default([]),
  category: SERVICE_CATEGORY.default("GENERAL"),
  priority: SERVICE_PRIORITY.default("P3"),
});
export type ServiceIssueCreateInput = z.infer<typeof ServiceIssueCreateInput>;

export const ServiceIssueTriageInput = z.object({
  category: SERVICE_CATEGORY,
  priority: SERVICE_PRIORITY,
  coverage: SERVICE_COVERAGE,
  coverageOverrideReason: z.string().max(500).optional(),
  assignedToUserId: z.string().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});
export type ServiceIssueTriageInput = z.infer<typeof ServiceIssueTriageInput>;

export const ServiceVisitLogInput = z.object({
  arrivedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  findings: z.string().max(4000).optional(),
  workPerformed: z.string().max(4000).optional(),
  partsUsed: z.array(PART_LINE).optional(),
  photoUrls: z.array(z.string().url()).default([]),
  geoLat: z.number().min(-90).max(90).optional(),
  geoLng: z.number().min(-180).max(180).optional(),
  signatureUrl: z.string().url().optional(),
  offlineClientOpId: z.string().uuid().optional(),
});
export type ServiceVisitLogInput = z.infer<typeof ServiceVisitLogInput>;

export const ServiceIssueCloseInput = z.object({
  clientSignoffName: z.string().min(1).max(120),
  closureNotes: z.string().max(2000).optional(),
  billableAmount: decimalString.optional(),
});
export type ServiceIssueCloseInput = z.infer<typeof ServiceIssueCloseInput>;

// ---------- Material indents ----------

export const MaterialIndentLineInput = z.object({
  materialId: z.string().min(1),
  requestedQty: decimalString,
  notes: z.string().max(500).nullable().optional(),
});
export type MaterialIndentLineInput = z.infer<typeof MaterialIndentLineInput>;

export const MaterialIndentInput = z.object({
  projectId: z.string().min(1),
  notes: z.string().max(2000).nullable().optional(),
  lines: z.array(MaterialIndentLineInput).min(1, "At least one line item required"),
});
export type MaterialIndentInput = z.infer<typeof MaterialIndentInput>;

export const IssueIndentLineInput = z.object({
  qtyToIssue: decimalString,
  note: z.string().max(500).nullable().optional(),
  issuedAt: z.string().datetime().optional(),
});
export type IssueIndentLineInput = z.infer<typeof IssueIndentLineInput>;

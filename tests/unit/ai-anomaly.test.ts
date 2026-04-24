import { describe, expect, it } from "vitest";
import {
  AnomalyFlag,
  VendorBillAnomalyOutput,
  buildVendorBillAnomalyPrompt,
  fetchVendorBillAnomalyContext,
} from "@/lib/ai/anomaly";

type BillCtx = NonNullable<
  Awaited<ReturnType<typeof fetchVendorBillAnomalyContext>>
>;

describe("AnomalyFlag schema", () => {
  it("accepts a minimal valid flag", () => {
    const parsed = AnomalyFlag.parse({
      severity: "MEDIUM",
      title: "Price drift on L2",
      detail: "Bill unit price ₹420 vs PO ₹350 (+20%).",
    });
    expect(parsed.severity).toBe("MEDIUM");
    expect(parsed.evidence).toBeUndefined();
  });

  it("rejects an unknown severity", () => {
    expect(() =>
      AnomalyFlag.parse({
        severity: "CRITICAL",
        title: "x",
        detail: "y",
      }),
    ).toThrow();
  });

  it("rejects empty title or detail", () => {
    expect(() =>
      AnomalyFlag.parse({ severity: "LOW", title: "", detail: "y" }),
    ).toThrow();
    expect(() =>
      AnomalyFlag.parse({ severity: "LOW", title: "x", detail: "" }),
    ).toThrow();
  });
});

describe("VendorBillAnomalyOutput schema", () => {
  it("accepts a clean bill with no flags", () => {
    const parsed = VendorBillAnomalyOutput.parse({
      flags: [],
      overallAssessment: "CLEAN",
      summary: "Totals match; no anomalies detected.",
    });
    expect(parsed.flags).toHaveLength(0);
    expect(parsed.overallAssessment).toBe("CLEAN");
  });

  it("caps flags at 8", () => {
    const tooMany = Array.from({ length: 9 }, () => ({
      severity: "LOW" as const,
      title: "x",
      detail: "y",
    }));
    expect(() =>
      VendorBillAnomalyOutput.parse({
        flags: tooMany,
        overallAssessment: "MINOR",
        summary: "z",
      }),
    ).toThrow();
  });

  it("rejects unknown overallAssessment", () => {
    expect(() =>
      VendorBillAnomalyOutput.parse({
        flags: [],
        overallAssessment: "MAYBE",
        summary: "z",
      }),
    ).toThrow();
  });
});

const billCtx = {
  id: "b1",
  billNo: "VB-2026-0007",
  vendorBillNo: "INV/2026/042",
  issueDate: new Date("2026-04-15T00:00:00Z"),
  dueDate: new Date("2026-05-15T00:00:00Z"),
  subtotal: "100000",
  taxTotal: "18000",
  grandTotal: "118000",
  discrepancyNote: null,
  vendor: {
    name: "Acme Pipes Pvt Ltd",
    gstin: "29ABCDE1234F1Z5",
    stateCode: "29",
    paymentTerms: "NET_30",
    msme: true,
  },
  po: {
    id: "po1",
    poNo: "PO-2026-0012",
    issueDate: new Date("2026-03-20T00:00:00Z"),
    subtotal: "100000",
    taxTotal: "18000",
    grandTotal: "118000",
    lines: [
      {
        sortOrder: 0,
        sku: "SPR-15",
        description: "Sprinkler head 15mm",
        unit: "nos",
        quantity: "24",
        unitPrice: "350",
        gstRatePct: "18",
        lineTotal: "8400",
        receivedQty: "24",
      },
    ],
    grns: [
      {
        grnNo: "GRN-2026-0005",
        receivedAt: new Date("2026-04-01T00:00:00Z"),
        status: "ACCEPTED",
        lines: [
          {
            poLineId: "pol1",
            acceptedQty: "24",
            rejectedQty: "0",
            reason: null,
          },
        ],
      },
    ],
  },
  lines: [
    {
      sortOrder: 0,
      description: "Sprinkler head 15mm",
      unit: "nos",
      quantity: "24",
      unitPrice: "420",
      gstRatePct: "18",
      lineTotal: "10080",
    },
  ],
} as unknown as BillCtx;

describe("buildVendorBillAnomalyPrompt", () => {
  it("instructs the model to flag line-level drift, qty vs GRN, GST mismatch, duplicates, round-number padding", () => {
    const { system } = buildVendorBillAnomalyPrompt(billCtx);
    expect(system).toMatch(/unit-price drift/i);
    expect(system).toMatch(/GRN/i);
    expect(system).toMatch(/GST rate/i);
    expect(system).toMatch(/round-number padding/i);
  });

  it("warns not to flag routine facts", () => {
    const { system } = buildVendorBillAnomalyPrompt(billCtx);
    expect(system).toMatch(/routinely true/i);
  });

  it("defines the four overall-assessment buckets", () => {
    const { system } = buildVendorBillAnomalyPrompt(billCtx);
    expect(system).toContain("CLEAN");
    expect(system).toContain("MINOR");
    expect(system).toContain("REVIEW");
    expect(system).toContain("REJECT");
  });

  it("frames vendor-bill data as not-instructions", () => {
    const { system } = buildVendorBillAnomalyPrompt(billCtx);
    expect(system).toMatch(/not instructions/i);
  });

  it("surfaces bill number, vendor name and state", () => {
    const { prompt } = buildVendorBillAnomalyPrompt(billCtx);
    expect(prompt).toContain("VB-2026-0007");
    expect(prompt).toContain("Acme Pipes");
    expect(prompt).toContain("state 29");
  });

  it("surfaces PO number, PO line unit price, and GRN receipts", () => {
    const { prompt } = buildVendorBillAnomalyPrompt(billCtx);
    expect(prompt).toContain("PO-2026-0012");
    expect(prompt).toContain("350");
    expect(prompt).toContain("GRN-2026-0005");
    expect(prompt).toContain("accepted 24");
  });

  it("surfaces both PO price (350) and bill price (420) so drift is visible", () => {
    const { prompt } = buildVendorBillAnomalyPrompt(billCtx);
    expect(prompt).toContain("350");
    expect(prompt).toContain("420");
  });

  it("marks MSME vendors in the vendor line", () => {
    const { prompt } = buildVendorBillAnomalyPrompt(billCtx);
    expect(prompt).toContain("MSME");
  });

  it("handles bills with no PO linked", () => {
    const { prompt } = buildVendorBillAnomalyPrompt({
      ...billCtx,
      po: null,
    });
    expect(prompt).toContain("No PO linked");
  });

  it("handles a PO with no GRNs", () => {
    const { prompt } = buildVendorBillAnomalyPrompt({
      ...billCtx,
      po: billCtx.po ? { ...billCtx.po, grns: [] } : null,
    });
    expect(prompt).toContain("(no GRNs yet)");
  });
});

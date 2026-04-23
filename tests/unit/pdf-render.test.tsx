import React from "react";
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";

// Silence "unused" for the JSX transform.
void React;
import { TaxInvoiceDocument } from "@/server/pdf/invoice-pdf";
import { QuoteDocument } from "@/server/pdf/quote-pdf";
import { PurchaseOrderDocument } from "@/server/pdf/po-pdf";

// Stub minimal Prisma-shaped records for each of the three PDFs. The goal is
// to hit the render path of the warm-paper editorial templates and assert we
// get back a valid PDF buffer (starts with "%PDF-"), which catches react-pdf
// runtime errors that tsc can't see (e.g. bad style props, Text nesting).

const D = Prisma.Decimal;

// "PDF" is the ASCII signature of every PDF file.
function assertIsPdf(buffer: Buffer) {
  expect(buffer.length).toBeGreaterThan(200);
  const head = buffer.slice(0, 5).toString("ascii");
  expect(head).toBe("%PDF-");
}

describe("PDF renderers", () => {
  it("renders a tax invoice with the new editorial layout", async () => {
    const invoice = {
      id: "inv-1",
      invoiceNo: "SAB/26-27/0042",
      kind: "PROGRESS",
      status: "ISSUED",
      projectId: "p1",
      clientId: "c1",
      amcId: null,
      serviceIssueId: null,
      placeOfSupplyStateCode: "29",
      subtotal: new D("484200"),
      cgst: new D("43578"),
      sgst: new D("43578"),
      igst: new D(0),
      taxTotal: new D("87156"),
      grandTotal: new D("571356"),
      amountPaid: new D(0),
      poRef: "APL/PO/26/0047",
      notes:
        "Payment due within 30 days of invoice date. Please quote the invoice number on all remittances.",
      termsMd: null,
      issuedAt: new Date("2026-04-18"),
      dueAt: new Date("2026-05-18"),
      shareToken: "t",
      createdById: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      client: {
        id: "c1",
        name: "Apollo Hospitals Enterprise Ltd.",
        billingAddress: "154/11, Bannerghatta Main Road\nBengaluru — 560076",
        shippingAddress: null,
        gstin: "29AAACA1234M1Z1",
        contactName: null,
        email: null,
        phone: null,
        stateCode: "29",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      project: {
        id: "p1",
        code: "SAB-26-0041",
        name: "Fire hydrant system — Block A & B",
      },
      lines: [
        {
          id: "l1",
          invoiceId: "inv-1",
          sortOrder: 0,
          description: "Fire hydrant point installation — Block A (Level 1-4)",
          hsnSac: "7308",
          quantity: new D(12),
          unit: "nos",
          unitPrice: new D(48200),
          discountPct: new D(0),
          gstRatePct: new D(18),
          lineSubtotal: new D(578400),
          lineTax: new D(104112),
          lineTotal: new D(578400),
        },
      ],
    } as unknown as Parameters<typeof TaxInvoiceDocument>[0]["invoice"];

    const buf = await renderToBuffer(<TaxInvoiceDocument invoice={invoice} />);
    assertIsPdf(buf);
  }, 30000);

  it("renders a quotation", async () => {
    const quote = {
      id: "q1",
      quoteNo: "SAB-Q-26-0013",
      version: 1,
      status: "SENT",
      title: "Irrigation sprinkler refresh",
      clientId: "c1",
      placeOfSupplyStateCode: "29",
      subtotal: new D(100000),
      taxTotal: new D(18000),
      grandTotal: new D(118000),
      validUntil: new Date("2026-05-31"),
      notes: null,
      termsMd: "50% advance, 50% on handover.",
      createdAt: new Date("2026-04-10"),
      updatedAt: new Date(),
      client: {
        name: "Apollo Hospitals Enterprise Ltd.",
        billingAddress: "154/11 Bannerghatta Main Rd, Bengaluru — 560076",
        gstin: "29AAACA1234M1Z1",
        contactName: "Priya R",
        email: null,
        phone: null,
        stateCode: "29",
      },
      lines: [
        {
          description: "4\" sprinkler head, brass",
          hsnSac: "8424",
          quantity: new D(24),
          unit: "nos",
          unitPrice: new D(2400),
          discountPct: new D(0),
          gstRatePct: new D(18),
          lineSubtotal: new D(57600),
          lineTax: new D(10368),
          lineTotal: new D(67968),
        },
      ],
    } as unknown as Parameters<typeof QuoteDocument>[0]["quote"];

    const buf = await renderToBuffer(<QuoteDocument quote={quote} />);
    assertIsPdf(buf);
  }, 30000);

  it("renders a work order (PO)", async () => {
    const po = {
      id: "po1",
      poNo: "SAB-WO-26-0007",
      issuedAt: new Date("2026-04-15"),
      plannedStart: new Date("2026-05-01"),
      plannedEnd: new Date("2026-07-30"),
      signedAt: null,
      clientPoNumber: "APL/PO/26/0047",
      clientPoDate: new Date("2026-03-28"),
      snapshotJson: {
        quote: {
          quoteNo: "SAB-Q-26-0013",
          title: "Block A hydrant installation",
          version: 2,
          placeOfSupplyStateCode: "29",
          subtotal: "800000",
          taxTotal: "144000",
          grandTotal: "944000",
          notes: null,
          termsMd: "Work at client site. Power and water by client.",
        },
        client: {
          name: "Apollo Hospitals Enterprise Ltd.",
          gstin: "29AAACA1234M1Z1",
          billingAddress: "154/11 Bannerghatta Main Rd, Bengaluru — 560076",
          shippingAddress: null,
          contactName: null,
          email: null,
          phone: null,
          stateCode: "29",
        },
        lines: [
          {
            sortOrder: 0,
            description: "Fire hydrant point installation",
            hsnSac: "7308",
            quantity: "22",
            unit: "nos",
            unitPrice: "36000",
            discountPct: "0",
            gstRatePct: "18",
            lineSubtotal: "792000",
            lineTax: "142560",
            lineTotal: "934560",
          },
        ],
      },
    } as unknown as Parameters<typeof PurchaseOrderDocument>[0]["po"];

    const buf = await renderToBuffer(
      <PurchaseOrderDocument
        po={po}
        projectCode="SAB-26-0041"
        projectName="Fire hydrant system — Block A & B"
      />,
    );
    assertIsPdf(buf);
  }, 30000);
});

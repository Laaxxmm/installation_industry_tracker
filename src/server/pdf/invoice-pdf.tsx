import React from "react";
import { Text, View } from "@react-pdf/renderer";
import type {
  Client,
  ClientInvoice,
  ClientInvoiceLine,
  Project,
} from "@prisma/client";
import {
  BankAndNotes,
  Doc,
  EditorialFooter,
  EditorialLineTable,
  InfoCol,
  InfoRow,
  MasterHeader,
  SubHeader,
  TotalsStack,
  money,
  qty,
  styles,
} from "./shared";
import { summarise } from "@/lib/gst";
import { sabBankDetails, sabStateCode } from "@/lib/org";
import { formatIST } from "@/lib/time";
import { amountInWords } from "@/lib/amount-in-words";

type FullInvoice = ClientInvoice & {
  client: Client;
  project: Project;
  lines: ClientInvoiceLine[];
};

const KIND_LABEL: Record<string, string> = {
  ADVANCE: "Advance invoice",
  PROGRESS: "Progress invoice",
  FINAL: "Final invoice",
  ADHOC: "Ad-hoc invoice",
  AMC_CONTRACT: "AMC contract invoice",
  AMC_INSTALLMENT: "AMC installment invoice",
  SERVICE_CALL: "Service call invoice",
};

export function TaxInvoiceDocument({ invoice }: { invoice: FullInvoice }) {
  const supplier = sabStateCode();
  const pos = invoice.placeOfSupplyStateCode;
  const intraState = supplier === pos;

  const summary = summarise({
    lines: invoice.lines.map((l) => ({
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
      discountPct: l.discountPct.toString(),
      gstRatePct: l.gstRatePct.toString(),
    })),
    supplierStateCode: supplier,
    placeOfSupplyStateCode: pos,
  });

  const kindLabel = KIND_LABEL[invoice.kind] ?? invoice.kind;
  const bankLines = sabBankDetails().split(/\n+/).filter(Boolean);

  // Project info: accent mono code + name + optional PO ref.
  const projectLines: Array<string | null> = [];
  if (invoice.poRef) projectLines.push(`PO: ${invoice.poRef}`);

  // Invoice type info: show kind + optional progress hint (cumulative billed
  // relative to project contract value, if available).
  const typeLines: string[] = [];
  const amountPaid = Number(invoice.amountPaid ?? 0);
  const grand = Number(summary.grandTotal);
  if (amountPaid > 0) {
    typeLines.push(`Paid so far: ${money(amountPaid)}`);
  }
  if (invoice.kind === "PROGRESS" || invoice.kind === "ADVANCE") {
    typeLines.push(`This invoice: ${money(grand)}`);
  }

  return (
    <Doc title={`Tax Invoice ${invoice.invoiceNo}`}>
      <MasterHeader docTitle="TAX INVOICE" docNumber={invoice.invoiceNo} />

      <SubHeader
        meta={[
          [
            "Issued",
            invoice.issuedAt ? formatIST(invoice.issuedAt, "dd MMM yyyy") : "—",
          ],
          ["Due", invoice.dueAt ? formatIST(invoice.dueAt, "dd MMM yyyy") : "—"],
          ["Terms", invoice.poRef ? `PO ${invoice.poRef}` : "Net 30"],
        ]}
      />

      <InfoRow>
        <InfoCol
          label="Bill to"
          title={invoice.client.name}
          lines={[
            invoice.client.billingAddress,
            invoice.client.gstin ? `GSTIN ${invoice.client.gstin}` : null,
          ]}
        />
        <InfoCol
          label="Project"
          accentCode={invoice.project.code}
          title={invoice.project.name}
          lines={projectLines}
        />
        <InfoCol
          label="Invoice type"
          title={kindLabel}
          lines={typeLines}
        />
      </InfoRow>

      <EditorialLineTable
        lines={invoice.lines.map((l) => ({
          description: l.description,
          hsnSac: l.hsnSac,
          qty: qty(l.quantity.toString()),
          unit: l.unit,
          rate: money(l.unitPrice.toString()),
          amount: money(l.lineTotal.toString()),
        }))}
      />

      <View style={styles.bottomRow}>
        <View style={styles.bottomLeft}>
          <BankAndNotes bankLines={bankLines} notes={invoice.notes} />
        </View>
        <View style={styles.bottomRight}>
          <TotalsStack
            subtotal={money(summary.subtotal.toString())}
            cgst={money(summary.cgst.toString())}
            sgst={money(summary.sgst.toString())}
            igst={money(summary.igst.toString())}
            grandTotal={money(summary.grandTotal.toString())}
            intraState={intraState}
            dueLabel="Total due"
            dueSub="INR — incl. GST"
          />
        </View>
      </View>

      <Text style={[styles.infoSub, { marginTop: 12, fontSize: 8, color: "#6B635A" }]}>
        <Text style={{ textTransform: "uppercase", letterSpacing: 1 }}>
          In words:{" "}
        </Text>
        {amountInWords(summary.grandTotal.toString())}
      </Text>

      {invoice.termsMd && (
        <Text
          style={[
            styles.infoSub,
            { marginTop: 10, fontSize: 8, color: "#6B635A" },
          ]}
        >
          <Text style={{ textTransform: "uppercase", letterSpacing: 1 }}>
            Terms:{" "}
          </Text>
          {invoice.termsMd}
        </Text>
      )}

      <EditorialFooter
        docLabel={`Tax Invoice ${invoice.invoiceNo}`}
        signatoryTitle="Authorised signatory"
      />
    </Doc>
  );
}

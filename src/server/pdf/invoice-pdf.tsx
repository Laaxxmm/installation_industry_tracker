import React from "react";
import { Text, View } from "@react-pdf/renderer";
import type {
  Client,
  ClientInvoice,
  ClientInvoiceLine,
  Project,
} from "@prisma/client";
import {
  ClientBlock,
  CompanyHeader,
  Doc,
  GstSummaryTable,
  LineTable,
  MetaBlock,
  PageFooter,
  SignatureBlock,
  TotalsBlock,
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

  const meta = [
    `#${invoice.invoiceNo}`,
    invoice.issuedAt
      ? `Issued: ${formatIST(invoice.issuedAt, "dd-MM-yyyy")}`
      : `Draft`,
    invoice.dueAt ? `Due: ${formatIST(invoice.dueAt, "dd-MM-yyyy")}` : "",
    `Kind: ${invoice.kind}`,
  ].filter(Boolean);

  return (
    <Doc title={`Tax Invoice ${invoice.invoiceNo}`}>
      <CompanyHeader title="TAX INVOICE" metaLines={meta} />

      <View style={styles.twoCol}>
        <ClientBlock
          label="Bill to"
          name={invoice.client.name}
          gstin={invoice.client.gstin}
          address={invoice.client.billingAddress}
          contactName={invoice.client.contactName}
          email={invoice.client.email}
          phone={invoice.client.phone}
          stateCode={invoice.client.stateCode}
        />
        <MetaBlock
          label="Details"
          pairs={[
            ["Project", `${invoice.project.code} — ${invoice.project.name}`],
            ["Place of supply", `State ${pos}`],
            ["Kind", invoice.kind],
            ["Status", invoice.status],
            ["PO ref", invoice.poRef ?? "—"],
            ["IRN", "—"],
          ]}
        />
      </View>

      <LineTable
        lines={invoice.lines.map((l) => ({
          description: l.description,
          hsnSac: l.hsnSac,
          quantity: l.quantity.toString(),
          unit: l.unit,
          unitPrice: l.unitPrice.toString(),
          discountPct: l.discountPct.toString(),
          gstRatePct: l.gstRatePct.toString(),
          lineSubtotal: l.lineSubtotal.toString(),
          lineTax: l.lineTax.toString(),
          lineTotal: l.lineTotal.toString(),
        }))}
      />

      <TotalsBlock
        subtotal={summary.subtotal.toFixed(2)}
        cgst={summary.cgst.toFixed(2)}
        sgst={summary.sgst.toFixed(2)}
        igst={summary.igst.toFixed(2)}
        taxTotal={summary.taxTotal.toFixed(2)}
        grandTotal={summary.grandTotal.toFixed(2)}
        intraState={intraState}
      />

      <GstSummaryTable
        rows={summary.gstBreakdown.map((r) => ({
          ratePct: r.ratePct,
          taxable: r.taxable.toFixed(2),
          cgst: r.cgst.toFixed(2),
          sgst: r.sgst.toFixed(2),
          igst: r.igst.toFixed(2),
        }))}
        intraState={intraState}
      />

      <Text style={styles.amountWords}>
        Amount in words: {amountInWords(summary.grandTotal.toString())}
      </Text>

      <View style={{ marginTop: 12, flexDirection: "row", gap: 16 }}>
        <View style={styles.col}>
          <Text style={styles.sectionLabel}>Bank details</Text>
          <View style={styles.boxed}>
            {sabBankDetails()
              .split(/\n+/)
              .map((ln, i) => (
                <Text key={i} style={styles.addressLine}>
                  {ln}
                </Text>
              ))}
          </View>
        </View>
        {invoice.termsMd && (
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Terms</Text>
            <View style={styles.boxed}>
              <Text style={styles.addressLine}>{invoice.termsMd}</Text>
            </View>
          </View>
        )}
      </View>

      {invoice.notes && (
        <View style={styles.note}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <Text>{invoice.notes}</Text>
        </View>
      )}

      <SignatureBlock rightLabel={`For SAB India — Authorised signatory`} />

      <PageFooter note={`Tax Invoice ${invoice.invoiceNo}`} />
    </Doc>
  );
}

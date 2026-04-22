import React from "react";
import { Text, View } from "@react-pdf/renderer";
import type { Client, Quote, QuoteLine } from "@prisma/client";
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
import { sabStateCode } from "@/lib/org";
import { formatIST } from "@/lib/time";

type FullQuote = Quote & { client: Client; lines: QuoteLine[] };

export function QuoteDocument({ quote }: { quote: FullQuote }) {
  const supplier = sabStateCode();
  const pos = quote.placeOfSupplyStateCode;
  const intraState = supplier === pos;

  const summary = summarise({
    lines: quote.lines.map((l) => ({
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
      discountPct: l.discountPct.toString(),
      gstRatePct: l.gstRatePct.toString(),
    })),
    supplierStateCode: supplier,
    placeOfSupplyStateCode: pos,
  });

  const title =
    quote.status === "CONVERTED" || quote.status === "ACCEPTED"
      ? "QUOTATION"
      : "QUOTATION";

  const meta = [
    `#${quote.quoteNo}${quote.version > 1 ? ` (v${quote.version})` : ""}`,
    `Issued: ${formatIST(quote.createdAt, "dd-MM-yyyy")}`,
    quote.validUntil
      ? `Valid until: ${formatIST(quote.validUntil, "dd-MM-yyyy")}`
      : "",
  ].filter(Boolean);

  return (
    <Doc title={`Quote ${quote.quoteNo}`}>
      <CompanyHeader title={title} metaLines={meta} />

      <View style={styles.twoCol}>
        <ClientBlock
          label="Quote for"
          name={quote.client.name}
          gstin={quote.client.gstin}
          address={quote.client.billingAddress}
          contactName={quote.client.contactName}
          email={quote.client.email}
          phone={quote.client.phone}
          stateCode={quote.client.stateCode}
        />
        <MetaBlock
          label="Details"
          pairs={[
            ["Title", quote.title],
            ["Place of supply", `State ${pos}`],
            ["Status", quote.status],
            ["Version", `v${quote.version}`],
          ]}
        />
      </View>

      <LineTable
        lines={quote.lines.map((l) => ({
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

      {quote.notes && (
        <View style={styles.note}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <Text>{quote.notes}</Text>
        </View>
      )}

      {quote.termsMd && (
        <View style={styles.note}>
          <Text style={styles.sectionLabel}>Terms &amp; conditions</Text>
          <Text>{quote.termsMd}</Text>
        </View>
      )}

      <SignatureBlock />

      <PageFooter note={`Quote ${quote.quoteNo}`} />
    </Doc>
  );
}

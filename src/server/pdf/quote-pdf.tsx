import React from "react";
import { Text, View } from "@react-pdf/renderer";
import type { Client, Quote, QuoteLine } from "@prisma/client";
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

  const docNo =
    quote.version > 1 ? `${quote.quoteNo} · v${quote.version}` : quote.quoteNo;
  const bankLines = sabBankDetails().split(/\n+/).filter(Boolean);

  return (
    <Doc title={`Quote ${quote.quoteNo}`}>
      <MasterHeader docTitle="QUOTATION" docNumber={docNo} />

      <SubHeader
        meta={[
          ["Issued", formatIST(quote.createdAt, "dd MMM yyyy")],
          [
            "Valid till",
            quote.validUntil
              ? formatIST(quote.validUntil, "dd MMM yyyy")
              : "—",
          ],
          ["Status", quote.status],
        ]}
      />

      <InfoRow>
        <InfoCol
          label="Quote for"
          title={quote.client.name}
          lines={[
            quote.client.billingAddress,
            quote.client.gstin ? `GSTIN ${quote.client.gstin}` : null,
          ]}
        />
        <InfoCol
          label="Project"
          title={quote.title}
          lines={[
            `Place of supply: state ${pos}`,
            quote.client.contactName
              ? `Attn: ${quote.client.contactName}`
              : null,
          ]}
        />
        <InfoCol
          label="Revision"
          title={`v${quote.version}`}
          lines={[
            `Status · ${quote.status}`,
            quote.version > 1 ? "Supersedes prior versions" : null,
          ]}
        />
      </InfoRow>

      <EditorialLineTable
        lines={quote.lines.map((l) => ({
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
          <BankAndNotes bankLines={bankLines} notes={quote.notes} />
        </View>
        <View style={styles.bottomRight}>
          <TotalsStack
            subtotal={money(summary.subtotal.toString())}
            cgst={money(summary.cgst.toString())}
            sgst={money(summary.sgst.toString())}
            igst={money(summary.igst.toString())}
            grandTotal={money(summary.grandTotal.toString())}
            intraState={intraState}
            dueLabel="Quoted total"
            dueSub="INR — incl. GST"
          />
        </View>
      </View>

      {quote.termsMd && (
        <Text
          style={[
            styles.infoSub,
            { marginTop: 12, fontSize: 8, color: "#6B635A" },
          ]}
        >
          <Text style={{ textTransform: "uppercase", letterSpacing: 1 }}>
            Terms &amp; conditions:{" "}
          </Text>
          {quote.termsMd}
        </Text>
      )}

      <EditorialFooter
        docLabel={`Quote ${quote.quoteNo}`}
        signatoryTitle="For SAB India"
      />
    </Doc>
  );
}

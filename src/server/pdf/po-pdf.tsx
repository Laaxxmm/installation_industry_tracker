import React from "react";
import { Text, View } from "@react-pdf/renderer";
import type { PurchaseOrder } from "@prisma/client";
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
import { formatIST } from "@/lib/time";
import { sabBankDetails, sabStateCode } from "@/lib/org";

type SnapshotShape = {
  quote: {
    quoteNo: string;
    title: string;
    version: number;
    placeOfSupplyStateCode: string;
    subtotal: string;
    taxTotal: string;
    grandTotal: string;
    notes?: string | null;
    termsMd?: string | null;
  };
  client: {
    name: string;
    gstin: string | null;
    billingAddress: string;
    shippingAddress: string | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    stateCode: string;
  };
  lines: Array<{
    sortOrder: number;
    description: string;
    hsnSac: string | null;
    quantity: string;
    unit: string;
    unitPrice: string;
    discountPct: string;
    gstRatePct: string;
    lineSubtotal: string;
    lineTax: string;
    lineTotal: string;
  }>;
};

export function PurchaseOrderDocument({
  po,
  projectCode,
  projectName,
}: {
  po: PurchaseOrder;
  projectCode: string;
  projectName: string;
}) {
  const snapshot = po.snapshotJson as unknown as SnapshotShape;
  const supplier = sabStateCode();
  const pos = snapshot.quote.placeOfSupplyStateCode;
  const intraState = supplier === pos;

  const taxTotal = Number(snapshot.quote.taxTotal);
  const half = (taxTotal / 2).toFixed(2);

  const bankLines = sabBankDetails().split(/\n+/).filter(Boolean);

  // Project column: dates + source quote
  const projectLines: string[] = [
    `Planned: ${formatIST(po.plannedStart, "dd MMM")} – ${formatIST(po.plannedEnd, "dd MMM yyyy")}`,
    `Source: quote ${snapshot.quote.quoteNo} v${snapshot.quote.version}`,
  ];

  const clientPoLines: Array<string | null> = [
    po.clientPoNumber ? `Client PO: ${po.clientPoNumber}` : null,
    po.clientPoDate ? `Dated: ${formatIST(po.clientPoDate, "dd MMM yyyy")}` : null,
    po.signedAt
      ? `Signed: ${formatIST(po.signedAt, "dd MMM yyyy")}`
      : "Awaiting client signature",
  ];

  return (
    <Doc title={`Work Order ${po.poNo}`}>
      <MasterHeader docTitle="WORK ORDER" docNumber={po.poNo} />

      <SubHeader
        meta={[
          ["Issued", formatIST(po.issuedAt, "dd MMM yyyy")],
          ["Project", projectCode],
          ["Quote", `${snapshot.quote.quoteNo} v${snapshot.quote.version}`],
        ]}
      />

      <InfoRow>
        <InfoCol
          label="Client"
          title={snapshot.client.name}
          lines={[
            snapshot.client.billingAddress,
            snapshot.client.gstin ? `GSTIN ${snapshot.client.gstin}` : null,
          ]}
        />
        <InfoCol
          label="Project"
          accentCode={projectCode}
          title={projectName}
          lines={projectLines}
        />
        <InfoCol
          label="Authorisation"
          title={snapshot.quote.title}
          lines={clientPoLines}
        />
      </InfoRow>

      <EditorialLineTable
        lines={snapshot.lines.map((l) => ({
          description: l.description,
          hsnSac: l.hsnSac,
          qty: qty(l.quantity),
          unit: l.unit,
          rate: money(l.unitPrice),
          amount: money(l.lineTotal),
        }))}
      />

      <View style={styles.bottomRow}>
        <View style={styles.bottomLeft}>
          <BankAndNotes bankLines={bankLines} notes={snapshot.quote.notes} />
        </View>
        <View style={styles.bottomRight}>
          <TotalsStack
            subtotal={money(snapshot.quote.subtotal)}
            cgst={intraState ? money(half) : undefined}
            sgst={intraState ? money(half) : undefined}
            igst={!intraState ? money(taxTotal) : undefined}
            grandTotal={money(snapshot.quote.grandTotal)}
            intraState={intraState}
            dueLabel="Work order value"
            dueSub="INR — incl. GST"
          />
        </View>
      </View>

      {snapshot.quote.termsMd && (
        <Text
          style={[
            styles.infoSub,
            { marginTop: 12, fontSize: 8, color: "#6B635A" },
          ]}
        >
          <Text style={{ textTransform: "uppercase", letterSpacing: 1 }}>
            Terms &amp; conditions:{" "}
          </Text>
          {snapshot.quote.termsMd}
        </Text>
      )}

      <EditorialFooter
        docLabel={`Work Order ${po.poNo}`}
        signatoryTitle={po.signedAt ? "Signed" : "For SAB India"}
      />
    </Doc>
  );
}

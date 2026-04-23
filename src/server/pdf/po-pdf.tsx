import React from "react";
import { Text, View } from "@react-pdf/renderer";
import type { PurchaseOrder } from "@prisma/client";
import {
  ClientBlock,
  CompanyHeader,
  Doc,
  LineTable,
  MetaBlock,
  PageFooter,
  SignatureBlock,
  TotalsBlock,
  styles,
} from "./shared";
import { formatIST } from "@/lib/time";
import { sabStateCode } from "@/lib/org";

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

  // Reconstruct CGST/SGST/IGST split from snapshot tax (groupings aren't stored;
  // we present aggregate totals only on the WO).
  const taxTotal = snapshot.quote.taxTotal;
  const half = (Number(taxTotal) / 2).toFixed(2);

  return (
    <Doc title={`Work Order ${po.poNo}`}>
      <CompanyHeader
        title="WORK ORDER"
        metaLines={[
          `#${po.poNo}`,
          `Issued: ${formatIST(po.issuedAt, "dd-MM-yyyy")}`,
          `Project: ${projectCode}`,
        ]}
      />

      <View style={styles.twoCol}>
        <ClientBlock
          label="Client"
          name={snapshot.client.name}
          gstin={snapshot.client.gstin}
          address={snapshot.client.billingAddress}
          contactName={snapshot.client.contactName}
          email={snapshot.client.email}
          phone={snapshot.client.phone}
          stateCode={snapshot.client.stateCode}
        />
        <MetaBlock
          label="Project"
          pairs={[
            ["Name", projectName],
            ["Code", projectCode],
            ["Planned start", formatIST(po.plannedStart, "dd-MM-yyyy")],
            ["Planned end", formatIST(po.plannedEnd, "dd-MM-yyyy")],
            ["Source quote", `${snapshot.quote.quoteNo} v${snapshot.quote.version}`],
            ["Client PO #", po.clientPoNumber ?? "—"],
            [
              "Client PO date",
              po.clientPoDate ? formatIST(po.clientPoDate, "dd-MM-yyyy") : "—",
            ],
          ]}
        />
      </View>

      <LineTable lines={snapshot.lines} />

      <TotalsBlock
        subtotal={snapshot.quote.subtotal}
        cgst={intraState ? half : undefined}
        sgst={intraState ? half : undefined}
        igst={!intraState ? taxTotal : undefined}
        taxTotal={taxTotal}
        grandTotal={snapshot.quote.grandTotal}
        intraState={intraState}
      />

      {snapshot.quote.termsMd && (
        <View style={styles.note}>
          <Text style={styles.sectionLabel}>Terms &amp; conditions</Text>
          <Text>{snapshot.quote.termsMd}</Text>
        </View>
      )}

      <SignatureBlock
        leftLabel="Signed by client"
        rightLabel={
          po.signedAt
            ? `Signed on ${formatIST(po.signedAt)}`
            : "For and on behalf of SAB India"
        }
      />

      <PageFooter note={`Work Order ${po.poNo}`} />
    </Doc>
  );
}

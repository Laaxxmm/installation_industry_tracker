import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Font,
} from "@react-pdf/renderer";
import { sabAddress, sabCompanyName, sabGstin } from "@/lib/org";

// Single font registration guard (Font.register runs once per process).
let fontsRegistered = false;
export function ensureFonts() {
  if (fontsRegistered) return;
  // Use the default Helvetica family — no external fetch required.
  fontsRegistered = true;
}

const BRAND = "#0B5CAD";
const BORDER = "#CBD5E1";
const TEXT = "#0F172A";
const MUTED = "#64748B";
const SOFT = "#F1F5F9";

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: TEXT,
    paddingHorizontal: 36,
    paddingTop: 36,
    paddingBottom: 60,
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 10,
    marginBottom: 14,
  },
  logoBlock: { flexDirection: "column" },
  logoMark: {
    width: 36,
    height: 36,
    backgroundColor: BRAND,
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 18,
    paddingTop: 7,
    marginBottom: 6,
  },
  companyName: { fontSize: 14, fontWeight: "bold", color: BRAND },
  companyLine: { fontSize: 9, color: MUTED, marginTop: 2 },
  docTitle: { fontSize: 20, fontWeight: "bold", color: BRAND, textAlign: "right" },
  docMeta: { fontSize: 9, color: MUTED, textAlign: "right", marginTop: 4 },
  twoCol: { flexDirection: "row", gap: 16, marginBottom: 14 },
  col: { flex: 1 },
  sectionLabel: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: MUTED,
    marginBottom: 4,
  },
  boxed: {
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
    borderRadius: 3,
  },
  clientName: { fontSize: 11, fontWeight: "bold" },
  addressLine: { fontSize: 9, color: TEXT, marginTop: 2, lineHeight: 1.3 },
  mono: { fontFamily: "Courier", fontSize: 9 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: SOFT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: MUTED,
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableCell: { fontSize: 9 },
  right: { textAlign: "right" },
  totalsBlock: {
    alignSelf: "flex-end",
    width: 260,
    marginTop: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    fontSize: 10,
  },
  totalGrandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    fontSize: 12,
    fontWeight: "bold",
    color: BRAND,
  },
  amountWords: {
    marginTop: 10,
    fontSize: 9,
    fontStyle: "italic",
    color: TEXT,
  },
  note: { fontSize: 9, color: TEXT, marginTop: 10, lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: MUTED,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  signBlock: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signBox: {
    width: 220,
  },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: TEXT,
    marginTop: 40,
    paddingTop: 4,
    fontSize: 9,
    color: MUTED,
    textAlign: "center",
  },
});

export function CompanyHeader({
  title,
  metaLines = [],
}: {
  title: string;
  metaLines?: string[];
}) {
  const name = sabCompanyName();
  const address = sabAddress();
  const gstin = sabGstin();
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={styles.headerBar}>
      <View style={styles.logoBlock}>
        <Text style={styles.logoMark}>{initials || "S"}</Text>
        <Text style={styles.companyName}>{name}</Text>
        {address.split(/\n+/).map((ln, i) => (
          <Text key={i} style={styles.companyLine}>
            {ln}
          </Text>
        ))}
        <Text style={[styles.companyLine, styles.mono]}>GSTIN: {gstin}</Text>
      </View>
      <View>
        <Text style={styles.docTitle}>{title}</Text>
        {metaLines.map((m, i) => (
          <Text key={i} style={styles.docMeta}>
            {m}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function ClientBlock({
  label = "Bill To",
  name,
  gstin,
  address,
  contactName,
  email,
  phone,
  stateCode,
}: {
  label?: string;
  name: string;
  gstin?: string | null;
  address: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  stateCode?: string;
}) {
  return (
    <View style={styles.col}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.boxed}>
        <Text style={styles.clientName}>{name}</Text>
        {gstin && (
          <Text style={[styles.addressLine, styles.mono]}>GSTIN: {gstin}</Text>
        )}
        {address.split(/\n+/).map((ln, i) => (
          <Text key={i} style={styles.addressLine}>
            {ln}
          </Text>
        ))}
        {stateCode && (
          <Text style={styles.addressLine}>State code: {stateCode}</Text>
        )}
        {contactName && (
          <Text style={styles.addressLine}>Contact: {contactName}</Text>
        )}
        {email && <Text style={styles.addressLine}>{email}</Text>}
        {phone && <Text style={styles.addressLine}>{phone}</Text>}
      </View>
    </View>
  );
}

export function MetaBlock({
  label,
  pairs,
}: {
  label: string;
  pairs: Array<[string, string | undefined | null]>;
}) {
  return (
    <View style={styles.col}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.boxed}>
        {pairs.map(([k, v], i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 9, color: MUTED }}>{k}</Text>
            <Text style={{ fontSize: 9, fontWeight: "bold" }}>{v ?? "—"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function LineTable({
  lines,
  showGst = true,
}: {
  lines: Array<{
    description: string;
    hsnSac?: string | null;
    quantity: string;
    unit: string;
    unitPrice: string;
    discountPct: string;
    gstRatePct?: string;
    lineSubtotal: string;
    lineTax: string;
    lineTotal: string;
  }>;
  showGst?: boolean;
}) {
  const col = {
    num: 22,
    desc: showGst ? 170 : 200,
    hsn: 42,
    qty: 36,
    unit: 30,
    price: 52,
    disc: 30,
    gst: 28,
    taxable: 55,
    tax: 48,
    total: 58,
  };
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: col.num }]}>#</Text>
        <Text style={[styles.tableHeaderCell, { width: col.desc }]}>
          Description
        </Text>
        <Text style={[styles.tableHeaderCell, { width: col.hsn }]}>HSN</Text>
        <Text style={[styles.tableHeaderCell, styles.right, { width: col.qty }]}>
          Qty
        </Text>
        <Text style={[styles.tableHeaderCell, { width: col.unit }]}>Unit</Text>
        <Text
          style={[styles.tableHeaderCell, styles.right, { width: col.price }]}
        >
          Price
        </Text>
        <Text
          style={[styles.tableHeaderCell, styles.right, { width: col.disc }]}
        >
          Disc%
        </Text>
        {showGst && (
          <Text
            style={[styles.tableHeaderCell, styles.right, { width: col.gst }]}
          >
            GST%
          </Text>
        )}
        <Text
          style={[styles.tableHeaderCell, styles.right, { width: col.taxable }]}
        >
          Taxable
        </Text>
        <Text style={[styles.tableHeaderCell, styles.right, { width: col.tax }]}>
          Tax
        </Text>
        <Text
          style={[styles.tableHeaderCell, styles.right, { width: col.total }]}
        >
          Total
        </Text>
      </View>
      {lines.map((l, i) => (
        <View key={i} style={styles.tableRow} wrap={false}>
          <Text style={[styles.tableCell, { width: col.num, color: MUTED }]}>
            {i + 1}
          </Text>
          <Text style={[styles.tableCell, { width: col.desc }]}>
            {l.description}
          </Text>
          <Text
            style={[styles.tableCell, styles.mono, { width: col.hsn }]}
          >
            {l.hsnSac ?? "—"}
          </Text>
          <Text style={[styles.tableCell, styles.right, { width: col.qty }]}>
            {l.quantity}
          </Text>
          <Text style={[styles.tableCell, { width: col.unit }]}>{l.unit}</Text>
          <Text
            style={[styles.tableCell, styles.right, { width: col.price }]}
          >
            {l.unitPrice}
          </Text>
          <Text
            style={[styles.tableCell, styles.right, { width: col.disc }]}
          >
            {l.discountPct}
          </Text>
          {showGst && (
            <Text
              style={[styles.tableCell, styles.right, { width: col.gst }]}
            >
              {l.gstRatePct ?? "0"}
            </Text>
          )}
          <Text
            style={[styles.tableCell, styles.right, { width: col.taxable }]}
          >
            {l.lineSubtotal}
          </Text>
          <Text style={[styles.tableCell, styles.right, { width: col.tax }]}>
            {l.lineTax}
          </Text>
          <Text
            style={[
              styles.tableCell,
              styles.right,
              { width: col.total, fontWeight: "bold" },
            ]}
          >
            {l.lineTotal}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function GstSummaryTable({
  rows,
  intraState,
}: {
  rows: Array<{
    ratePct: string;
    taxable: string;
    cgst: string;
    sgst: string;
    igst: string;
  }>;
  intraState: boolean;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.sectionLabel}>GST breakdown</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: 50 }]}>Rate</Text>
        <Text style={[styles.tableHeaderCell, styles.right, { width: 80 }]}>
          Taxable
        </Text>
        {intraState ? (
          <>
            <Text style={[styles.tableHeaderCell, styles.right, { width: 70 }]}>
              CGST
            </Text>
            <Text style={[styles.tableHeaderCell, styles.right, { width: 70 }]}>
              SGST
            </Text>
          </>
        ) : (
          <Text style={[styles.tableHeaderCell, styles.right, { width: 70 }]}>
            IGST
          </Text>
        )}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tableRow} wrap={false}>
          <Text style={[styles.tableCell, { width: 50 }]}>{r.ratePct}%</Text>
          <Text style={[styles.tableCell, styles.right, { width: 80 }]}>
            {r.taxable}
          </Text>
          {intraState ? (
            <>
              <Text style={[styles.tableCell, styles.right, { width: 70 }]}>
                {r.cgst}
              </Text>
              <Text style={[styles.tableCell, styles.right, { width: 70 }]}>
                {r.sgst}
              </Text>
            </>
          ) : (
            <Text style={[styles.tableCell, styles.right, { width: 70 }]}>
              {r.igst}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

export function TotalsBlock({
  subtotal,
  cgst,
  sgst,
  igst,
  taxTotal,
  grandTotal,
  intraState,
}: {
  subtotal: string;
  cgst?: string;
  sgst?: string;
  igst?: string;
  taxTotal: string;
  grandTotal: string;
  intraState: boolean;
}) {
  return (
    <View style={styles.totalsBlock}>
      <View style={styles.totalRow}>
        <Text>Subtotal</Text>
        <Text>{subtotal}</Text>
      </View>
      {intraState ? (
        <>
          <View style={styles.totalRow}>
            <Text>CGST</Text>
            <Text>{cgst ?? "0.00"}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>SGST</Text>
            <Text>{sgst ?? "0.00"}</Text>
          </View>
        </>
      ) : (
        <View style={styles.totalRow}>
          <Text>IGST</Text>
          <Text>{igst ?? "0.00"}</Text>
        </View>
      )}
      <View style={styles.totalRow}>
        <Text>Tax total</Text>
        <Text>{taxTotal}</Text>
      </View>
      <View style={styles.totalGrandRow}>
        <Text>Grand total</Text>
        <Text>{grandTotal}</Text>
      </View>
    </View>
  );
}

export function SignatureBlock({
  leftLabel = "For and on behalf of the Client",
  rightLabel,
}: {
  leftLabel?: string;
  rightLabel?: string;
}) {
  const right = rightLabel ?? `For ${sabCompanyName()}`;
  return (
    <View style={styles.signBlock}>
      <View style={styles.signBox}>
        <Text style={styles.signLine}>{leftLabel}</Text>
      </View>
      <View style={styles.signBox}>
        <Text style={styles.signLine}>{right}</Text>
      </View>
    </View>
  );
}

export function PageFooter({ note }: { note?: string }) {
  return (
    <Text
      style={styles.footer}
      render={({ pageNumber, totalPages }) =>
        `${note ? note + "  ·  " : ""}Page ${pageNumber} of ${totalPages}`
      }
      fixed
    />
  );
}

export function Doc({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  ensureFonts();
  return (
    <Document title={title} author={sabCompanyName()}>
      <Page size="A4" style={styles.page}>
        {children}
      </Page>
    </Document>
  );
}

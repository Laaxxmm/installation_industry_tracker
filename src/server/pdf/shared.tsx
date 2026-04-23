import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { sabAddress, sabCompanyName, sabGstin } from "@/lib/org";
import { inr } from "@/components/sab/format";

// Warm-paper editorial palette — sRGB approximations of the oklch() tokens
// used in the web UI (oklch() is not supported by react-pdf).
const PAPER = "#FAF8F2";
const INK = "#3A3530";
const INK2 = "#6B635A";
const INK3 = "#958C7F";
const RULE = "#E6E1D5";
const RULE_STRONG = "#D3CCBC";
const ACCENT = "#D2783F"; // SAB orange
const ACCENT_INK = "#A8532A";
const ACCENT_WASH = "#FAE9DD";

// react-pdf Font.register is not needed — Helvetica + Courier ship with pdfkit.
let fontsRegistered = false;
export function ensureFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;
}

/* =========================================================================
 *  Stylesheet
 * ========================================================================= */

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
    backgroundColor: PAPER,
    paddingHorizontal: 40,
    paddingTop: 32,
    paddingBottom: 64,
    lineHeight: 1.35,
  },

  // ---------- Master header: brand left, doc title + no. right ----------
  masterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandTile: {
    width: 22,
    height: 22,
    backgroundColor: ACCENT,
    color: "white",
    textAlign: "center",
    fontSize: 9,
    fontWeight: "bold",
    paddingTop: 5,
    letterSpacing: 0.6,
  },
  brandWordmark: { fontSize: 13, fontWeight: "bold", color: INK },
  brandSubtitle: {
    fontSize: 7.5,
    color: INK3,
    marginTop: 1,
    fontStyle: "italic",
  },
  docEyebrow: {
    fontSize: 8,
    color: INK3,
    textAlign: "right",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  docNumber: {
    fontFamily: "Courier",
    fontSize: 18,
    color: INK,
    textAlign: "right",
    marginTop: 3,
    letterSpacing: 0.4,
  },

  // Thin horizontal separator used throughout
  hr: {
    borderBottomWidth: 0.6,
    borderBottomColor: RULE_STRONG,
    marginVertical: 10,
  },
  hrSoft: {
    borderBottomWidth: 0.4,
    borderBottomColor: RULE,
    marginVertical: 8,
  },

  // ---------- Sub-header: address left, meta right ----------
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  addressBlock: { width: "60%" },
  addressLine: {
    fontFamily: "Courier",
    fontSize: 8,
    color: INK2,
    lineHeight: 1.45,
  },
  addressLead: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: INK,
    marginBottom: 2,
  },
  metaBlock: { width: "38%" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  metaKey: {
    fontFamily: "Courier",
    fontSize: 8,
    color: INK3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metaVal: {
    fontFamily: "Courier",
    fontSize: 9,
    color: INK,
  },

  // ---------- Three-column info row (Bill to / Project / Invoice type) ----------
  infoRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 14,
  },
  infoCol: {
    flex: 1,
    borderTopWidth: 0.8,
    borderTopColor: INK,
    paddingTop: 6,
  },
  infoLabel: {
    fontSize: 7,
    color: INK3,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  infoTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: INK,
    marginBottom: 2,
  },
  infoSub: { fontSize: 8.5, color: INK2, lineHeight: 1.4 },
  infoSubMono: {
    fontFamily: "Courier",
    fontSize: 8,
    color: INK3,
    marginTop: 1,
  },
  infoAccent: {
    fontFamily: "Courier",
    fontSize: 9,
    color: ACCENT_INK,
    letterSpacing: 0.3,
  },

  // ---------- Line-item table ----------
  tableHead: {
    flexDirection: "row",
    borderTopWidth: 0.8,
    borderBottomWidth: 0.4,
    borderColor: INK,
    paddingVertical: 5,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  tableHeadCell: {
    fontSize: 7,
    color: INK3,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.3,
    borderBottomColor: RULE,
    paddingVertical: 7,
    paddingHorizontal: 2,
  },
  tableCell: { fontSize: 9, color: INK },
  tableCellMono: {
    fontFamily: "Courier",
    fontSize: 9,
    color: INK,
  },
  tableCellMonoMuted: {
    fontFamily: "Courier",
    fontSize: 8.5,
    color: INK3,
  },
  right: { textAlign: "right" },

  // ---------- Bottom split: bank/notes left, totals right ----------
  bottomRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 16,
  },
  bottomLeft: { flex: 1 },
  bottomRight: { width: 210 },

  sectionCaps: {
    fontSize: 7,
    color: INK3,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalKey: { fontSize: 9, color: INK2 },
  totalVal: {
    fontFamily: "Courier",
    fontSize: 9.5,
    color: INK,
  },
  totalDueBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: ACCENT_WASH,
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
  },
  totalDueLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: ACCENT_INK,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  totalDueSub: {
    fontSize: 7,
    color: INK3,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 1,
  },
  totalDueVal: {
    fontFamily: "Courier",
    fontSize: 15,
    fontWeight: "bold",
    color: ACCENT_INK,
  },

  // ---------- Footer ----------
  footer: {
    position: "absolute",
    bottom: 26,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 0.4,
    borderTopColor: RULE,
    paddingTop: 8,
  },
  footerLeft: {
    fontFamily: "Courier",
    fontSize: 7.5,
    color: INK3,
  },
  footerRight: {
    width: 160,
    textAlign: "right",
  },
  signLine: {
    fontSize: 9,
    color: INK,
    fontStyle: "italic",
    textAlign: "right",
    marginBottom: 2,
  },
  signCaption: {
    fontFamily: "Courier",
    fontSize: 7.5,
    color: INK3,
    textAlign: "right",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

/* =========================================================================
 *  Primitives
 * ========================================================================= */

/** Warm-paper master header: brand tile+wordmark left, doc title+no. right. */
export function MasterHeader({
  docTitle,
  docNumber,
}: {
  docTitle: string;
  docNumber: string;
}) {
  return (
    <View style={styles.masterHeader}>
      <View style={styles.brandRow}>
        <Text style={styles.brandTile}>S</Text>
        <View>
          <Text style={styles.brandWordmark}>SAB India Tracker</Text>
          <Text style={styles.brandSubtitle}>Powered by indefine</Text>
        </View>
      </View>
      <View>
        <Text style={styles.docEyebrow}>{docTitle}</Text>
        <Text style={styles.docNumber}>{docNumber}</Text>
      </View>
    </View>
  );
}

/**
 * Sub-header: company address lines on the left, a small meta table (Issued
 * / Due / Terms-style pairs) on the right.
 */
export function SubHeader({
  meta,
}: {
  meta: Array<[string, string | null | undefined]>;
}) {
  const name = sabCompanyName();
  const addressLines = sabAddress().split(/\n+/).filter(Boolean);
  const gstin = sabGstin();
  return (
    <View style={styles.subHeader}>
      <View style={styles.addressBlock}>
        <Text style={styles.addressLead}>{name}</Text>
        {addressLines.map((ln, i) => (
          <Text key={i} style={styles.addressLine}>
            {ln}
          </Text>
        ))}
        <Text style={styles.addressLine}>GSTIN {gstin}</Text>
      </View>
      <View style={styles.metaBlock}>
        {meta
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v], i) => (
            <View key={i} style={styles.metaRow}>
              <Text style={styles.metaKey}>{k}</Text>
              <Text style={styles.metaVal}>{v}</Text>
            </View>
          ))}
      </View>
    </View>
  );
}

/**
 * One cell of the three-column info strip (Bill to / Project / Invoice type).
 * Accepts a title + optional subtitle lines + optional mono-accent code.
 */
export function InfoCol({
  label,
  accentCode,
  title,
  subtitle,
  lines = [],
}: {
  label: string;
  accentCode?: string;
  title?: string;
  subtitle?: string;
  lines?: Array<string | null | undefined>;
}) {
  return (
    <View style={styles.infoCol}>
      <Text style={styles.infoLabel}>{label}</Text>
      {accentCode && <Text style={styles.infoAccent}>{accentCode}</Text>}
      {title && <Text style={styles.infoTitle}>{title}</Text>}
      {subtitle && <Text style={styles.infoSub}>{subtitle}</Text>}
      {lines
        .filter((l): l is string => !!l)
        .map((ln, i) => (
          <Text key={i} style={styles.infoSub}>
            {ln}
          </Text>
        ))}
    </View>
  );
}

export function InfoRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.infoRow}>{children}</View>;
}

/**
 * Six-column line-item table: #, description, qty, unit, rate, amount.
 * Values pre-formatted with Indian grouping (₹5,78,400) by the caller.
 */
export function EditorialLineTable({
  lines,
}: {
  lines: Array<{
    description: string;
    hsnSac?: string | null;
    qty: string;
    unit: string;
    rate: string;
    amount: string;
  }>;
}) {
  const col = {
    num: 26,
    desc: "1 1 auto" as unknown as number,
    qty: 36,
    unit: 36,
    rate: 70,
    amount: 74,
  };
  return (
    <View>
      <View style={styles.tableHead}>
        <Text style={[styles.tableHeadCell, { width: col.num }]}>#</Text>
        <Text style={[styles.tableHeadCell, { flexGrow: 1, flexShrink: 1 }]}>
          Description
        </Text>
        <Text
          style={[styles.tableHeadCell, styles.right, { width: col.qty }]}
        >
          Qty
        </Text>
        <Text
          style={[styles.tableHeadCell, styles.right, { width: col.unit }]}
        >
          Unit
        </Text>
        <Text
          style={[styles.tableHeadCell, styles.right, { width: col.rate }]}
        >
          Rate
        </Text>
        <Text
          style={[styles.tableHeadCell, styles.right, { width: col.amount }]}
        >
          Amount
        </Text>
      </View>
      {lines.map((l, i) => (
        <View key={i} style={styles.tableRow} wrap={false}>
          <Text
            style={[styles.tableCellMonoMuted, { width: col.num }]}
          >
            {String(i + 1).padStart(2, "0")}
          </Text>
          <View style={{ flexGrow: 1, flexShrink: 1, paddingRight: 6 }}>
            <Text style={styles.tableCell}>{l.description}</Text>
            {l.hsnSac && (
              <Text style={[styles.tableCellMonoMuted, { marginTop: 1 }]}>
                HSN {l.hsnSac}
              </Text>
            )}
          </View>
          <Text
            style={[styles.tableCellMono, styles.right, { width: col.qty }]}
          >
            {l.qty}
          </Text>
          <Text
            style={[styles.tableCellMonoMuted, styles.right, { width: col.unit }]}
          >
            {l.unit}
          </Text>
          <Text
            style={[styles.tableCellMono, styles.right, { width: col.rate }]}
          >
            {l.rate}
          </Text>
          <Text
            style={[
              styles.tableCellMono,
              styles.right,
              { width: col.amount, fontWeight: "bold" },
            ]}
          >
            {l.amount}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Totals stack right column: subtotal, CGST/SGST or IGST, tax total, then
 *  a warm accent-washed TOTAL DUE row. */
export function TotalsStack({
  subtotal,
  cgst,
  sgst,
  igst,
  grandTotal,
  intraState,
  dueLabel = "Total due",
  dueSub = "INR — incl. GST",
}: {
  subtotal: string;
  cgst?: string;
  sgst?: string;
  igst?: string;
  grandTotal: string;
  intraState: boolean;
  dueLabel?: string;
  dueSub?: string;
}) {
  return (
    <View>
      <View style={styles.totalLine}>
        <Text style={styles.totalKey}>Subtotal</Text>
        <Text style={styles.totalVal}>{subtotal}</Text>
      </View>
      {intraState ? (
        <>
          <View style={styles.totalLine}>
            <Text style={styles.totalKey}>CGST @ 9%</Text>
            <Text style={styles.totalVal}>{cgst ?? "—"}</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalKey}>SGST @ 9%</Text>
            <Text style={styles.totalVal}>{sgst ?? "—"}</Text>
          </View>
        </>
      ) : (
        <View style={styles.totalLine}>
          <Text style={styles.totalKey}>IGST @ 18%</Text>
          <Text style={styles.totalVal}>{igst ?? "—"}</Text>
        </View>
      )}
      <View style={styles.totalDueBox}>
        <View>
          <Text style={styles.totalDueLabel}>{dueLabel}</Text>
          <Text style={styles.totalDueSub}>{dueSub}</Text>
        </View>
        <Text style={styles.totalDueVal}>{grandTotal}</Text>
      </View>
    </View>
  );
}

/** Bank details + optional notes block (bottom-left of most docs). */
export function BankAndNotes({
  bankLines,
  notes,
}: {
  bankLines: string[];
  notes?: string | null;
}) {
  return (
    <View>
      <Text style={styles.sectionCaps}>Bank details</Text>
      {bankLines.map((ln, i) => (
        <Text key={i} style={styles.addressLine}>
          {ln}
        </Text>
      ))}
      {notes && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.sectionCaps}>Notes</Text>
          <Text style={[styles.infoSub, { fontSize: 8.5 }]}>{notes}</Text>
        </View>
      )}
    </View>
  );
}

/** A labelled block (terms, notes, etc.) used below totals if needed. */
export function LabelledBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.sectionCaps}>{label}</Text>
      <Text style={styles.infoSub}>{children}</Text>
    </View>
  );
}

/** Page footer: generated-by line on the left, signature on the right. */
export function EditorialFooter({
  docLabel,
  signatoryName,
  signatoryTitle = "Authorised signatory",
}: {
  docLabel: string;
  signatoryName?: string | null;
  signatoryTitle?: string;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text
        style={styles.footerLeft}
        render={({ pageNumber, totalPages }) =>
          `Generated by SAB Tracker  ·  Powered by indefine  ·  ${docLabel}  ·  Page ${pageNumber} of ${totalPages}`
        }
      />
      <View style={styles.footerRight}>
        {signatoryName && (
          <Text style={styles.signLine}>{signatoryName}</Text>
        )}
        <Text style={styles.signCaption}>{signatoryTitle}</Text>
      </View>
    </View>
  );
}

/** Document wrapper. */
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

/* =========================================================================
 *  Money formatter for PDF values (Indian grouping, 2dp, leading ₹).
 * ========================================================================= */

export function money(v: string | number): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return inr(n, { compact: false });
}

export function qty(v: string | number): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  // Keep trailing zero-decimal compact: 12 not 12.00, but 1.5 not 1
  return Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

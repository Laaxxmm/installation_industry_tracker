import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { InvoiceStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";
import { amountInWords } from "@/lib/amount-in-words";
import { sabStateCode } from "@/lib/org";
import { InvoiceLinesEditor } from "./InvoiceLinesEditor";
import { InvoiceLifecycleActions } from "./InvoiceLifecycleActions";
import { ShareLinkBlock } from "./ShareLinkBlock";
import { EditInvoiceHeaderButton } from "./EditInvoiceHeaderButton";

const STATUS_PILL: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-sky-100 text-sky-800",
  PAID: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { id } = await params;

  const invoice = await db.clientInvoice.findUnique({
    where: { id },
    include: {
      client: true,
      project: { select: { id: true, code: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true } },
    },
  });
  if (!invoice) notFound();

  const isDraft = invoice.status === InvoiceStatus.DRAFT;
  const intraState = sabStateCode() === invoice.placeOfSupplyStateCode;

  return (
    <div>
      <Link
        href="/invoices"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-brand"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
      </Link>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-3">
            <span className="font-mono text-[11px] font-semibold tracking-normal text-brand">
              {isDraft ? "DRAFT" : invoice.invoiceNo}
            </span>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                STATUS_PILL[invoice.status] ?? "bg-slate-100 text-slate-700",
              )}
            >
              {invoice.status}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
              {invoice.kind}
            </span>
          </span>
        }
        title={
          invoice.issuedAt
            ? `Tax Invoice · ${formatIST(invoice.issuedAt, "dd MMM yyyy")}`
            : "Tax Invoice (Draft)"
        }
        description={
          <Link
            href={`/projects/${invoice.project.id}`}
            className="hover:underline"
          >
            {invoice.project.code} · {invoice.project.name}
          </Link>
        }
        actions={
          !isDraft && (
            <a
              href={`/api/pdf/invoice/${invoice.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </a>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
              <CardDescription>
                Place of supply state {invoice.placeOfSupplyStateCode} ·{" "}
                {intraState ? "Intra-state (CGST+SGST)" : "Inter-state (IGST)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-[13px] md:grid-cols-4">
              <KV label="Subtotal" value={formatINR(invoice.subtotal)} />
              {intraState ? (
                <>
                  <KV label="CGST" value={formatINR(invoice.cgst)} />
                  <KV label="SGST" value={formatINR(invoice.sgst)} />
                </>
              ) : (
                <KV label="IGST" value={formatINR(invoice.igst)} />
              )}
              <KV label="Tax total" value={formatINR(invoice.taxTotal)} />
              <KV
                label="Grand total"
                value={formatINR(invoice.grandTotal)}
                bold
              />
              {invoice.status !== InvoiceStatus.DRAFT && (
                <>
                  <KV
                    label="Amount paid"
                    value={formatINR(invoice.amountPaid)}
                  />
                  <KV
                    label="Balance"
                    value={formatINR(
                      invoice.grandTotal.minus(invoice.amountPaid),
                    )}
                  />
                </>
              )}
            </CardContent>
            <CardContent className="border-t border-slate-100 pt-3 text-[12px] italic text-slate-600">
              {amountInWords(invoice.grandTotal.toString())}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lines</CardTitle>
              <CardDescription>
                {isDraft
                  ? "Editable while DRAFT. Frozen after issue."
                  : "Issued — lines are frozen."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceLinesEditor
                invoiceId={invoice.id}
                placeOfSupplyStateCode={invoice.placeOfSupplyStateCode}
                supplierStateCode={sabStateCode()}
                readOnly={!isDraft}
                initialLines={invoice.lines.map((l) => ({
                  key: l.id,
                  description: l.description,
                  hsnSac: l.hsnSac ?? "",
                  quantity: l.quantity.toString(),
                  unit: l.unit,
                  unitPrice: l.unitPrice.toString(),
                  discountPct: l.discountPct.toString(),
                  gstRatePct: l.gstRatePct.toString(),
                }))}
              />
            </CardContent>
          </Card>

          {(invoice.notes || invoice.termsMd) && (
            <div className="grid gap-5 md:grid-cols-2">
              {invoice.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="whitespace-pre-wrap text-[13px] text-slate-700">
                    {invoice.notes}
                  </CardContent>
                </Card>
              )}
              {invoice.termsMd && (
                <Card>
                  <CardHeader>
                    <CardTitle>Terms</CardTitle>
                  </CardHeader>
                  <CardContent className="whitespace-pre-wrap text-[13px] text-slate-700">
                    {invoice.termsMd}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Bill to</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <div className="font-medium text-slate-900">
                {invoice.client.name}
              </div>
              {invoice.client.gstin && (
                <div className="font-mono text-[11px] text-slate-700">
                  GSTIN: {invoice.client.gstin}
                </div>
              )}
              <div className="whitespace-pre-wrap text-slate-700">
                {invoice.client.billingAddress}
              </div>
              <div className="text-[11px] text-slate-500">
                State code: {invoice.client.stateCode}
              </div>
            </CardContent>
          </Card>

          <InvoiceLifecycleActions
            invoiceId={invoice.id}
            status={invoice.status}
            grandTotal={invoice.grandTotal.toString()}
            amountPaid={invoice.amountPaid.toString()}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Meta</CardTitle>
              {isDraft && (
                <EditInvoiceHeaderButton
                  header={{
                    invoiceId: invoice.id,
                    kind: invoice.kind,
                    placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
                    dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
                    poRef: invoice.poRef,
                    notes: invoice.notes,
                    termsMd: invoice.termsMd,
                  }}
                />
              )}
            </CardHeader>
            <CardContent className="space-y-1 text-[12px]">
              <KV2 label="PO ref" value={invoice.poRef ?? "—"} />
              <KV2
                label="Due"
                value={
                  invoice.dueAt ? formatIST(invoice.dueAt, "dd-MM-yyyy") : "—"
                }
              />
              <KV2
                label="Issued"
                value={
                  invoice.issuedAt
                    ? formatIST(invoice.issuedAt, "dd-MM-yyyy")
                    : "—"
                }
              />
              <KV2
                label="Paid on"
                value={
                  invoice.paidAt ? formatIST(invoice.paidAt, "dd-MM-yyyy") : "—"
                }
              />
              <KV2 label="Created by" value={invoice.createdBy?.name ?? "—"} />
            </CardContent>
          </Card>

          {invoice.status !== InvoiceStatus.DRAFT &&
            invoice.status !== InvoiceStatus.CANCELLED && (
              <ShareLinkBlock
                invoiceId={invoice.id}
                shareToken={invoice.shareToken}
              />
            )}
        </div>
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={
          bold
            ? "mt-1 text-[16px] font-semibold tabular-nums text-slate-900"
            : "mt-1 tabular-nums text-slate-800"
        }
      >
        {value}
      </div>
    </div>
  );
}

function KV2({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Role,
  QuoteStatus,
  QuoteEventKind as QEK,
} from "@prisma/client";
import { Download, Link2 } from "lucide-react";
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
import { sabStateCode } from "@/lib/org";
import { QuoteStatusPill } from "../QuoteStatusPill";
import { QuoteLinesEditor } from "./QuoteLinesEditor";
import { QuoteLifecycleActions } from "./QuoteLifecycleActions";
import { ShareLinkBlock } from "./ShareLinkBlock";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { id } = await params;

  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { orderBy: { sortOrder: "asc" } },
      events: {
        orderBy: { at: "desc" },
        include: { actor: { select: { name: true } } },
      },
      parentQuote: { select: { id: true, quoteNo: true, version: true } },
      revisions: {
        select: { id: true, quoteNo: true, version: true, status: true },
        orderBy: { version: "asc" },
      },
      project: { select: { id: true, code: true, name: true } },
      po: { select: { id: true, poNo: true } },
    },
  });
  if (!quote) notFound();

  const editable: QuoteStatus[] = [
    QuoteStatus.DRAFT,
    QuoteStatus.REVISED,
    QuoteStatus.CHANGES_REQUESTED,
  ];
  const canEdit = editable.includes(quote.status);
  const canSend = canEdit;
  const ACCEPTABLE: QuoteStatus[] = [
    QuoteStatus.SENT,
    QuoteStatus.CHANGES_REQUESTED,
    QuoteStatus.NEGOTIATING,
    QuoteStatus.REVISED,
  ];
  const canAccept = ACCEPTABLE.includes(quote.status);
  const canConvert = quote.status === QuoteStatus.ACCEPTED;
  const canRevise =
    quote.status !== QuoteStatus.CONVERTED && quote.status !== QuoteStatus.LOST;

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/quotes" className="hover:text-brand">
            Quotes
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono text-[20px] font-semibold">
              {quote.quoteNo}
            </span>
            {quote.version > 1 && (
              <span className="rounded bg-violet-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-violet-700">
                v{quote.version}
              </span>
            )}
            <QuoteStatusPill status={quote.status} />
          </span>
        }
        description={
          <span className="text-[12px]">
            {quote.title} · <Link
              href={`/clients/${quote.clientId}`}
              className="text-brand hover:underline"
            >
              {quote.client.name}
            </Link>
            {quote.project && (
              <>
                {" · Converted to "}
                <Link
                  href={`/projects/${quote.project.id}`}
                  className="text-brand hover:underline"
                >
                  {quote.project.code}
                </Link>
              </>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <a
              href={`/api/pdf/quote/${quote.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
            </a>
            <QuoteLifecycleActions
              quoteId={quote.id}
              status={quote.status}
              canSend={canSend}
              canAccept={canAccept}
              canConvert={canConvert}
              canRevise={canRevise}
            />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-5">
          {/* Totals card */}
          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
              <CardDescription>
                Supplier state {sabStateCode()} · Place of supply{" "}
                {quote.placeOfSupplyStateCode} ·{" "}
                {sabStateCode() === quote.placeOfSupplyStateCode
                  ? "Intra-state (CGST + SGST)"
                  : "Inter-state (IGST)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-4 text-[13px]">
              <Num label="Subtotal" value={formatINR(quote.subtotal)} />
              <Num label="Tax total" value={formatINR(quote.taxTotal)} />
              <Num label="Grand total" value={formatINR(quote.grandTotal)} bold />
              <Num
                label="Valid until"
                value={
                  quote.validUntil ? formatIST(quote.validUntil, "dd-MM-yyyy") : "—"
                }
              />
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
              <CardDescription>
                {canEdit
                  ? "Editable while DRAFT / REVISED / CHANGES_REQUESTED."
                  : "Frozen in current status."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuoteLinesEditor
                quoteId={quote.id}
                canEdit={canEdit}
                placeOfSupplyStateCode={quote.placeOfSupplyStateCode}
                supplierStateCode={sabStateCode()}
                initialLines={quote.lines.map((l) => ({
                  key: l.id,
                  category: l.category,
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

          {/* Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Activity timeline</CardTitle>
              <CardDescription>
                {quote.events.length} event{quote.events.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ol className="divide-y divide-slate-100">
                {quote.events.map((e) => (
                  <li key={e.id} className="flex gap-3 px-5 py-3 text-[13px]">
                    <EventDot kind={e.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">
                          {KIND_LABEL[e.kind]}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatIST(e.at)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {e.actor?.name ?? "System"}
                        {e.fromStatus && e.toStatus && (
                          <>
                            {" · "}
                            {e.fromStatus} → {e.toStatus}
                          </>
                        )}
                      </div>
                      {e.note && (
                        <div className="mt-1 whitespace-pre-wrap text-slate-700">
                          {e.note}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Client block */}
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <div className="font-medium text-slate-900">{quote.client.name}</div>
              {quote.client.gstin && (
                <div className="font-mono text-[11px] text-slate-700">
                  GSTIN: {quote.client.gstin}
                </div>
              )}
              <div className="whitespace-pre-wrap text-slate-700">
                {quote.client.billingAddress}
              </div>
              {quote.client.contactName && (
                <div className="text-slate-600">
                  Contact: {quote.client.contactName}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Share */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" /> Public share link
                </span>
              </CardTitle>
              <CardDescription>
                Unauthenticated HTML view + PDF download.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShareLinkBlock
                quoteId={quote.id}
                shareToken={quote.shareToken}
                canSend={canSend}
                sent={!!quote.sentAt}
              />
            </CardContent>
          </Card>

          {/* Revisions */}
          {(quote.parentQuote || quote.revisions.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Revisions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-[12px]">
                {quote.parentQuote && (
                  <Link
                    href={`/quotes/${quote.parentQuote.id}`}
                    className="block font-mono text-slate-600 hover:text-brand"
                  >
                    ← parent: {quote.parentQuote.quoteNo} (v{quote.parentQuote.version})
                  </Link>
                )}
                {quote.revisions.map((r) => (
                  <Link
                    key={r.id}
                    href={`/quotes/${r.id}`}
                    className="block font-mono text-slate-600 hover:text-brand"
                  >
                    → child: {r.quoteNo} (v{r.version}) · {r.status}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* PO */}
          {quote.po && (
            <Card>
              <CardHeader>
                <CardTitle>Work Order</CardTitle>
              </CardHeader>
              <CardContent className="text-[13px]">
                <Link
                  href={`/projects/${quote.project!.id}/po`}
                  className="font-mono text-brand hover:underline"
                >
                  {quote.po.poNo}
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<QEK, string> = {
  SENT: "Quote sent",
  CLIENT_VIEWED: "Client viewed",
  ALTERATION_REQUESTED: "Alteration requested",
  CUSTOMIZATION_REQUESTED: "Customization requested",
  NEGOTIATION: "Negotiation",
  REVISION_ISSUED: "Revision issued",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  NOTE: "Note",
};

const KIND_DOT: Record<QEK, string> = {
  SENT: "#0B5CAD",
  CLIENT_VIEWED: "#0EA5E9",
  ALTERATION_REQUESTED: "#D97706",
  CUSTOMIZATION_REQUESTED: "#D97706",
  NEGOTIATION: "#F59E0B",
  REVISION_ISSUED: "#7C3AED",
  ACCEPTED: "#059669",
  REJECTED: "#DC2626",
  NOTE: "#64748B",
};

function EventDot({ kind }: { kind: QEK }) {
  return (
    <span
      className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: KIND_DOT[kind] }}
    />
  );
}

function Num({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={
          bold
            ? "mt-1 text-[18px] font-semibold tabular-nums text-slate-900"
            : "mt-1 text-[14px] tabular-nums text-slate-800"
        }
      >
        {value}
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
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
import { ProjectTabs } from "../ProjectTabs";
import { POMetaForm } from "./POMetaForm";
import { SignPOButton } from "./SignPOButton";

export default async function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const canEdit = hasRole(session, [Role.ADMIN, Role.MANAGER]);

  const project = await db.project.findUnique({
    where: { id },
    include: {
      purchaseOrder: {
        include: {
          quote: { select: { id: true, quoteNo: true, version: true } },
          signedBy: { select: { name: true } },
        },
      },
      client: true,
    },
  });
  if (!project) notFound();

  const po = project.purchaseOrder;

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href={`/projects/${project.id}`} className="hover:text-brand">
            {project.code}
          </Link>
        }
        title={project.name}
        description={project.clientName}
      />
      <div className="mb-5">
        <ProjectTabs projectId={project.id} />
      </div>

      {!po ? (
        <Card>
          <CardContent className="p-10 text-center text-[13px] text-slate-600">
            No Work Order for this project.
            <p className="mt-1 text-[11px] text-slate-500">
              Work Orders are auto-issued when an accepted quote is converted.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[16px]">{po.poNo}</span>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                        {po.status}
                      </span>
                    </span>
                    <a
                      href={`/api/pdf/po/${po.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Download className="h-3.5 w-3.5" /> Download PDF
                      </Button>
                    </a>
                  </span>
                </CardTitle>
                <CardDescription>
                  Issued {formatIST(po.issuedAt)} · From quote{" "}
                  <Link
                    href={`/quotes/${po.quote.id}`}
                    className="text-brand hover:underline"
                  >
                    {po.quote.quoteNo} v{po.quote.version}
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-[13px]">
                <KV label="Amount" value={formatINR(po.amount)} bold />
                <KV
                  label="Planned start"
                  value={formatIST(po.plannedStart, "dd-MM-yyyy")}
                />
                <KV
                  label="Planned end"
                  value={formatIST(po.plannedEnd, "dd-MM-yyyy")}
                />
              </CardContent>
            </Card>

            {canEdit && (
              <Card>
                <CardHeader>
                  <CardTitle>Client PO reference</CardTitle>
                  <CardDescription>
                    Capture the customer-issued PO number + date once received.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <POMetaForm
                    poId={po.id}
                    initial={{
                      clientPoNumber: po.clientPoNumber ?? "",
                      clientPoDate: po.clientPoDate
                        ? formatIST(po.clientPoDate, "yyyy-MM-dd")
                        : "",
                      plannedStart: formatIST(po.plannedStart, "yyyy-MM-dd"),
                      plannedEnd: formatIST(po.plannedEnd, "yyyy-MM-dd"),
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Lines from snapshot */}
            <Card>
              <CardHeader>
                <CardTitle>Lines (frozen snapshot)</CardTitle>
                <CardDescription>
                  Captured at conversion time. Edits to the quote after this do
                  not affect the Work Order.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <POSnapshotLines snapshot={po.snapshotJson} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Signed by</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[13px]">
                {po.signedAt ? (
                  <>
                    <div className="font-medium text-slate-900">
                      {po.signedBy?.name ?? "—"}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatIST(po.signedAt)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[12px] text-slate-600">
                      Not yet signed.
                    </div>
                    {canEdit && <SignPOButton poId={po.id} />}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[13px]">
                <div className="font-medium text-slate-900">
                  {project.client?.name ?? project.clientName}
                </div>
                {project.client?.gstin && (
                  <div className="font-mono text-[11px] text-slate-700">
                    GSTIN: {project.client.gstin}
                  </div>
                )}
                {project.client?.billingAddress && (
                  <div className="whitespace-pre-wrap text-slate-700">
                    {project.client.billingAddress}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
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

type SnapshotShape = {
  lines?: Array<{
    sortOrder: number;
    category: string;
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

function POSnapshotLines({ snapshot }: { snapshot: unknown }) {
  const s = snapshot as SnapshotShape;
  const lines = s?.lines ?? [];
  if (lines.length === 0) {
    return (
      <div className="px-5 py-6 text-center text-[12px] text-slate-500">
        No lines captured.
      </div>
    );
  }
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <th className="px-3 py-2">#</th>
          <th className="px-3 py-2">Description</th>
          <th className="px-3 py-2">HSN</th>
          <th className="px-3 py-2 text-right">Qty</th>
          <th className="px-3 py-2">Unit</th>
          <th className="px-3 py-2 text-right">Unit price</th>
          <th className="px-3 py-2 text-right">Taxable</th>
          <th className="px-3 py-2 text-right">Tax</th>
          <th className="px-3 py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr
            key={l.sortOrder}
            className="border-b border-slate-100 last:border-0"
          >
            <td className="px-3 py-2 tabular-nums text-slate-500">
              {l.sortOrder + 1}
            </td>
            <td className="px-3 py-2 text-slate-900">{l.description}</td>
            <td className="px-3 py-2 font-mono text-[11px]">
              {l.hsnSac ?? "—"}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
            <td className="px-3 py-2 text-[11px]">{l.unit}</td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatINR(l.unitPrice)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatINR(l.lineSubtotal)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatINR(l.lineTax)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums font-semibold">
              {formatINR(l.lineTotal)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

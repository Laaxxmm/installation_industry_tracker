import Link from "next/link";
import { notFound } from "next/navigation";
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
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatINR } from "@/lib/money";
import { formatIST } from "@/lib/time";
import { ClientForm } from "../ClientForm";
import { ArchiveToggle } from "./ArchiveToggle";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const canEdit = hasRole(session, [Role.ADMIN, Role.MANAGER]);

  const client = await db.client.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          contractValue: true,
          createdAt: true,
        },
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quoteNo: true,
          title: true,
          status: true,
          version: true,
          grandTotal: true,
          createdAt: true,
        },
      },
      clientInvoices: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNo: true,
          kind: true,
          status: true,
          grandTotal: true,
          amountPaid: true,
          issuedAt: true,
          dueAt: true,
        },
      },
    },
  });

  if (!client) notFound();

  const totalQuoteValue = client.quotes.reduce(
    (a, q) => a + Number(q.grandTotal),
    0,
  );
  const totalInvoiceValue = client.clientInvoices.reduce(
    (a, i) => a + Number(i.grandTotal),
    0,
  );
  const totalPaid = client.clientInvoices.reduce(
    (a, i) => a + Number(i.amountPaid),
    0,
  );

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/clients" className="hover:text-brand">
            Clients
          </Link>
        }
        title={client.name}
        description={
          <span className="flex flex-wrap items-center gap-2 text-[12px]">
            {client.gstin && (
              <span className="font-mono text-slate-700">{client.gstin}</span>
            )}
            <span className="text-slate-400">·</span>
            <span>State {client.stateCode}</span>
            {!client.active && (
              <>
                <span className="text-slate-400">·</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Archived
                </span>
              </>
            )}
          </span>
        }
        actions={canEdit ? <ArchiveToggle id={client.id} active={client.active} /> : null}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Projects" value={client.projects.length} />
        <StatCard label="Quotes" value={client.quotes.length} sub={formatINR(totalQuoteValue)} />
        <StatCard
          label="Invoiced"
          value={formatINR(totalInvoiceValue)}
          sub={`${client.clientInvoices.length} invoices`}
        />
        <StatCard label="Collected" value={formatINR(totalPaid)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr,1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>{canEdit ? "Edit details" : "Client details"}</CardTitle>
            <CardDescription>
              {canEdit
                ? "Name + GSTIN changes re-key any future quotes and invoices."
                : "Read-only view. Managers can edit."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <ClientForm
                mode="edit"
                initial={{
                  id: client.id,
                  name: client.name,
                  gstin: client.gstin,
                  pan: client.pan,
                  billingAddress: client.billingAddress,
                  shippingAddress: client.shippingAddress,
                  stateCode: client.stateCode,
                  contactName: client.contactName,
                  email: client.email,
                  phone: client.phone,
                  notes: client.notes,
                }}
              />
            ) : (
              <dl className="grid gap-3 text-[13px]">
                <Row label="PAN" value={client.pan} />
                <Row label="Billing" value={client.billingAddress} multiline />
                <Row label="Shipping" value={client.shippingAddress} multiline />
                <Row label="Contact" value={client.contactName} />
                <Row label="Email" value={client.email} />
                <Row label="Phone" value={client.phone} />
                <Row label="Notes" value={client.notes} multiline />
              </dl>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>
                {client.projects.length} linked project
                {client.projects.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {client.projects.length === 0 ? (
                <div className="px-5 py-6 text-center text-[12px] text-slate-500">
                  No projects yet.
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-2">Code</th>
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-5 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.projects.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-5 py-2.5 font-mono text-[11px]">
                          <Link
                            href={`/projects/${p.id}`}
                            className="text-brand hover:underline"
                          >
                            {p.code}
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 text-slate-900">{p.name}</td>
                        <td className="px-2 py-2.5">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {formatINR(p.contractValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quotes</CardTitle>
              <CardDescription>
                {client.quotes.length} quote{client.quotes.length === 1 ? "" : "s"} issued
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {client.quotes.length === 0 ? (
                <div className="px-5 py-6 text-center text-[12px] text-slate-500">
                  No quotes yet.
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-2">Quote</th>
                      <th className="px-2 py-2">Title</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-5 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.quotes.map((q) => (
                      <tr
                        key={q.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-5 py-2.5 font-mono text-[11px]">
                          <Link
                            href={`/quotes/${q.id}`}
                            className="text-brand hover:underline"
                          >
                            {q.quoteNo}
                          </Link>
                          {q.version > 1 && (
                            <span className="ml-1 text-[10px] text-slate-500">
                              v{q.version}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-slate-900">{q.title}</td>
                        <td className="px-2 py-2.5 text-[11px] font-medium text-slate-600">
                          {q.status}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {formatINR(q.grandTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>
                {client.clientInvoices.length} invoice
                {client.clientInvoices.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {client.clientInvoices.length === 0 ? (
                <div className="px-5 py-6 text-center text-[12px] text-slate-500">
                  No invoices yet.
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-2">Invoice</th>
                      <th className="px-2 py-2">Kind</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Issued</th>
                      <th className="px-5 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.clientInvoices.map((i) => (
                      <tr
                        key={i.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-5 py-2.5 font-mono text-[11px]">
                          <Link
                            href={`/invoices/${i.id}`}
                            className="text-brand hover:underline"
                          >
                            {i.invoiceNo}
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 text-[11px] text-slate-700">
                          {i.kind}
                        </td>
                        <td className="px-2 py-2.5 text-[11px] font-medium text-slate-600">
                          {i.status}
                        </td>
                        <td className="px-2 py-2.5 text-[11px] text-slate-600">
                          {i.issuedAt ? formatIST(i.issuedAt) : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {formatINR(i.grandTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value?: string | null;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px,1fr] items-start gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd
        className={
          multiline
            ? "whitespace-pre-wrap text-slate-800"
            : "text-slate-800"
        }
      >
        {value ?? <span className="text-slate-400">—</span>}
      </dd>
    </div>
  );
}

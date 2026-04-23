import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { db } from "@/server/db";
import { formatINR } from "@/lib/money";
import { formatIST } from "@/lib/time";
import { sabCompanyName, sabStateCode, sabGstin } from "@/lib/org";
import { summarise } from "@/lib/gst";

export const dynamic = "force-dynamic";

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const quote = await db.quote.findUnique({
    where: { shareToken: token },
    include: {
      client: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote) notFound();

  const intraState = sabStateCode() === quote.placeOfSupplyStateCode;
  const summary = summarise({
    lines: quote.lines.map((l) => ({
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
      discountPct: l.discountPct.toString(),
      gstRatePct: l.gstRatePct.toString(),
    })),
    supplierStateCode: sabStateCode(),
    placeOfSupplyStateCode: quote.placeOfSupplyStateCode,
  });

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-6 flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-6 py-5 shadow-card md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {sabCompanyName()} · GSTIN {sabGstin()}
            </div>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-slate-900">
              Quote {quote.quoteNo}
              {quote.version > 1 && (
                <span className="ml-2 rounded bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                  v{quote.version}
                </span>
              )}
            </h1>
            <p className="mt-0.5 text-[12px] text-slate-600">
              {quote.title} · Issued {formatIST(quote.createdAt, "dd-MM-yyyy")}
              {quote.validUntil && (
                <> · Valid until {formatIST(quote.validUntil, "dd-MM-yyyy")}</>
              )}
            </p>
          </div>
          <a
            href={`/api/pdf/public/quote/${token}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-4 text-[13px] font-medium text-white shadow-sm hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Download PDF
          </a>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <Block title="For">
            <div className="font-semibold text-slate-900">{quote.client.name}</div>
            {quote.client.gstin && (
              <div className="mt-1 font-mono text-[11px] text-slate-600">
                GSTIN: {quote.client.gstin}
              </div>
            )}
            <div className="mt-1 whitespace-pre-wrap text-[12px] text-slate-700">
              {quote.client.billingAddress}
            </div>
          </Block>
          <Block title="Details">
            <dl className="grid grid-cols-[120px,1fr] gap-y-1 text-[12px]">
              <dt className="text-slate-500">Place of supply</dt>
              <dd>State {quote.placeOfSupplyStateCode}</dd>
              <dt className="text-slate-500">Status</dt>
              <dd>{quote.status}</dd>
            </dl>
          </Block>
        </section>

        <section className="mt-6 overflow-hidden rounded-md border border-slate-200 bg-white shadow-card">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">HSN</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-right">GST</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((l, i) => (
                <tr
                  key={l.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-2 text-slate-900">{l.description}</td>
                  <td className="px-4 py-2 font-mono text-[11px]">
                    {l.hsnSac ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.quantity.toString()} {l.unit}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatINR(l.unitPrice)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.gstRatePct.toString()}%
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {formatINR(l.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-4 flex justify-end">
          <div className="w-[320px] rounded-md border border-slate-200 bg-white p-4 text-[13px] shadow-card">
            <TotalsRow label="Subtotal" value={formatINR(summary.subtotal)} />
            {intraState ? (
              <>
                <TotalsRow label="CGST" value={formatINR(summary.cgst)} />
                <TotalsRow label="SGST" value={formatINR(summary.sgst)} />
              </>
            ) : (
              <TotalsRow label="IGST" value={formatINR(summary.igst)} />
            )}
            <TotalsRow label="Tax total" value={formatINR(summary.taxTotal)} />
            <div className="mt-2 border-t border-slate-200 pt-2">
              <TotalsRow
                label="Grand total"
                value={formatINR(summary.grandTotal)}
                bold
              />
            </div>
          </div>
        </section>

        {(quote.notes || quote.termsMd) && (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {quote.notes && (
              <Block title="Notes">
                <p className="whitespace-pre-wrap text-[12px] text-slate-700">
                  {quote.notes}
                </p>
              </Block>
            )}
            {quote.termsMd && (
              <Block title="Terms &amp; conditions">
                <p className="whitespace-pre-wrap text-[12px] text-slate-700">
                  {quote.termsMd}
                </p>
              </Block>
            )}
          </section>
        )}

        <p className="mt-10 text-center text-[10px] text-slate-400">
          This is a web preview of {sabCompanyName()} quote {quote.quoteNo}. Keep the link private — it grants read-only access.
        </p>
      </div>
    </main>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      {children}
    </div>
  );
}

function TotalsRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-600"}>
        {label}
      </span>
      <span className={`tabular-nums ${bold ? "font-semibold text-slate-900" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}

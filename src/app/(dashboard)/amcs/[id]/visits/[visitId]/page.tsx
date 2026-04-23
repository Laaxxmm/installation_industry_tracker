import { notFound } from "next/navigation";
import Link from "next/link";
import { AMCVisitStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { PageHeader, Pill, fmtDate } from "@/components/sab";

const VISIT_TONE: Record<AMCVisitStatus, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  SCHEDULED: "blue",
  IN_PROGRESS: "amber",
  COMPLETED: "positive",
  MISSED: "alert",
  CANCELLED: "ink",
};

type PartLine = { sku?: string; description: string; qty: string | number; unit: string };
type CheckItem = { item: string; ok: boolean; note?: string };

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  await requireSession();
  const { id, visitId } = await params;

  const visit = await db.aMCVisit.findUnique({
    where: { id: visitId },
    include: {
      amc: { select: { id: true, contractNo: true, title: true } },
      assignedTo: { select: { name: true } },
    },
  });
  if (!visit || visit.amcId !== id) notFound();

  const parts = (visit.partsUsed as unknown as PartLine[] | null) ?? [];
  const checklist = (visit.checklist as unknown as CheckItem[] | null) ?? [];

  return (
    <div>
      <PageHeader
        eyebrow={`${visit.amc.contractNo} · Visit #${visit.visitNo}`}
        title={visit.amc.title}
        description={`Scheduled ${fmtDate(visit.scheduledDate)}`}
        actions={<Pill tone={VISIT_TONE[visit.status]}>{visit.status}</Pill>}
      />

      <div className="grid gap-4 max-w-3xl">
        <section
          className="rounded border p-4 grid gap-2"
          style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
        >
          <Row label="Assignee">{visit.assignedTo?.name ?? "Unassigned"}</Row>
          <Row label="Started">{visit.startedAt ? fmtDate(visit.startedAt) : "—"}</Row>
          <Row label="Completed">{visit.completedAt ? fmtDate(visit.completedAt) : "—"}</Row>
          {visit.findings && <Row label="Findings">{visit.findings}</Row>}
          {visit.notes && <Row label="Notes">{visit.notes}</Row>}
          {visit.geoLat && visit.geoLng && (
            <Row label="Geo">
              {Number(visit.geoLat).toFixed(4)}, {Number(visit.geoLng).toFixed(4)}
            </Row>
          )}
        </section>

        {checklist.length > 0 && (
          <section
            className="rounded border p-4"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
          >
            <h3 className="text-sm font-semibold mb-2">Checklist</h3>
            <ul className="grid gap-1 text-[13px]">
              {checklist.map((c, i) => (
                <li key={i}>
                  <span className="font-mono">{c.ok ? "✓" : "✗"}</span> {c.item}
                  {c.note ? ` — ${c.note}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        {parts.length > 0 && (
          <section
            className="rounded border p-4"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
          >
            <h3 className="text-sm font-semibold mb-2">Parts used</h3>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                  <th className="text-left py-1">Description</th>
                  <th className="text-left py-1">SKU</th>
                  <th className="text-right py-1">Qty</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                    <td className="py-1">{p.description}</td>
                    <td className="py-1 sab-code" style={{ fontSize: 11 }}>
                      {p.sku ?? "—"}
                    </td>
                    <td className="py-1 text-right font-mono">
                      {p.qty} {p.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {visit.photoUrls.length > 0 && (
          <section
            className="rounded border p-4"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
          >
            <h3 className="text-sm font-semibold mb-2">Photos</h3>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
              {visit.photoUrls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noreferrer" className="underline text-[12px]">
                  {u.split("/").pop()}
                </a>
              ))}
            </div>
          </section>
        )}

        <div>
          <Link href={`/amcs/${visit.amc.id}`} className="text-[13px] underline">
            ← Back to AMC
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-[13px]">
      <div className="sab-caps" style={{ color: "var(--sab-ink3)", fontSize: 10 }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

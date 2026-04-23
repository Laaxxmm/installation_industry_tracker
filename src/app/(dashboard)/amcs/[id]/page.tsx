import { notFound } from "next/navigation";
import Link from "next/link";
import { AMCStatus, AMCVisitStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { hasRole, requireSession } from "@/server/rbac";
import {
  approveAMC,
  cancelAMC,
  holdAMC,
  renewAMC,
  resumeAMC,
} from "@/server/actions/amcs";
import { Code, KPI, PageHeader, Pill, fmtDate, inr } from "@/components/sab";
import { AMCActions } from "../AMCActions";

const STATUS_TONE: Record<AMCStatus, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  DRAFT: "ink",
  PENDING_APPROVAL: "amber",
  ACTIVE: "positive",
  ON_HOLD: "amber",
  EXPIRED: "ink",
  CANCELLED: "alert",
  RENEWED: "blue",
};

const VISIT_TONE: Record<AMCVisitStatus, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  SCHEDULED: "blue",
  IN_PROGRESS: "amber",
  COMPLETED: "positive",
  MISSED: "alert",
  CANCELLED: "ink",
};

type AssetLine = { name: string; qty?: number; notes?: string };

export default async function AMCDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const canManage = hasRole(session, [Role.ADMIN, Role.MANAGER]);
  const { id } = await params;

  const amc = await db.aMC.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      slas: { orderBy: { priority: "asc" } },
      visits: {
        orderBy: { visitNo: "asc" },
        include: { assignedTo: { select: { name: true } } },
      },
      serviceIssues: {
        orderBy: { reportedAt: "desc" },
        take: 20,
      },
      invoices: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!amc) notFound();

  const completedVisits = amc.visits.filter((v) => v.status === AMCVisitStatus.COMPLETED).length;
  const missedVisits = amc.visits.filter((v) => v.status === AMCVisitStatus.MISSED).length;
  const upcomingVisits = amc.visits.filter((v) => v.status === AMCVisitStatus.SCHEDULED).length;
  const assets = (amc.assetsCovered as unknown as AssetLine[]) ?? [];

  async function handleApprove(idParam: string) {
    "use server";
    await approveAMC(idParam);
  }
  async function handleHold(idParam: string, reason: string) {
    "use server";
    await holdAMC(idParam, reason);
  }
  async function handleResume(idParam: string) {
    "use server";
    await resumeAMC(idParam);
  }
  async function handleCancel(idParam: string, reason: string) {
    "use server";
    await cancelAMC(idParam, reason);
  }
  async function handleRenew(idParam: string) {
    "use server";
    await renewAMC(idParam);
  }

  return (
    <div>
      <PageHeader
        eyebrow={`After-sales · ${amc.contractNo}`}
        title={amc.title}
        description={`${amc.client.name} · ${amc.project.name}`}
        actions={<Pill tone={STATUS_TONE[amc.status]}>{amc.status}</Pill>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <KPI label="Contract value" value={inr(Number(amc.grandTotal))} sub={`${amc.billingMode}`} accent />
        <KPI label="Visits completed" value={completedVisits} sub={`of ${amc.visits.length}`} />
        <KPI label="Upcoming" value={upcomingVisits} sub="SCHEDULED" />
        <KPI label="Missed" value={missedVisits} sub="needs attention" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-6">
          <section
            className="rounded border p-4"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
          >
            <h3 className="text-sm font-semibold mb-2">Overview</h3>
            <div className="grid gap-2 text-[13px]">
              <Row label="Type">{amc.type}</Row>
              <Row label="Billing">{amc.billingMode}</Row>
              <Row label="Frequency">
                {amc.frequency} · {amc.visitsPerYear}/yr
              </Row>
              <Row label="Window">
                {fmtDate(amc.startDate)} → {fmtDate(amc.endDate)}
              </Row>
              <Row label="Site address">{amc.siteAddress}</Row>
              {amc.exclusions && <Row label="Exclusions">{amc.exclusions}</Row>}
              {amc.notes && <Row label="Notes">{amc.notes}</Row>}
            </div>
          </section>

          <section
            className="rounded border p-4"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
          >
            <h3 className="text-sm font-semibold mb-2">Covered assets</h3>
            <ul className="text-[13px] list-disc pl-5">
              {assets.map((a, i) => (
                <li key={i}>
                  {a.name}
                  {a.qty ? ` × ${a.qty}` : ""}
                  {a.notes ? ` — ${a.notes}` : ""}
                </li>
              ))}
            </ul>
          </section>

          <section
            className="rounded border p-4"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
          >
            <h3 className="text-sm font-semibold mb-2">Visits</h3>
            <table className="w-full text-[12.5px] sab-tabular">
              <thead>
                <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                  <th className="text-left py-1.5 px-2 sab-caps" style={{ color: "var(--sab-ink3)" }}>
                    #
                  </th>
                  <th className="text-left py-1.5 px-2 sab-caps" style={{ color: "var(--sab-ink3)" }}>
                    Scheduled
                  </th>
                  <th className="text-left py-1.5 px-2 sab-caps" style={{ color: "var(--sab-ink3)" }}>
                    Status
                  </th>
                  <th className="text-left py-1.5 px-2 sab-caps" style={{ color: "var(--sab-ink3)" }}>
                    Assignee
                  </th>
                  <th className="text-left py-1.5 px-2 sab-caps" style={{ color: "var(--sab-ink3)" }}>
                    Completed
                  </th>
                </tr>
              </thead>
              <tbody>
                {amc.visits.map((v) => (
                  <tr key={v.id} className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                    <td className="py-1.5 px-2">
                      <Link href={`/amcs/${amc.id}/visits/${v.id}`} className="underline">
                        {v.visitNo}
                      </Link>
                    </td>
                    <td className="py-1.5 px-2 sab-code" style={{ fontSize: 11 }}>
                      {fmtDate(v.scheduledDate)}
                    </td>
                    <td className="py-1.5 px-2">
                      <Pill tone={VISIT_TONE[v.status]} size="sm">
                        {v.status}
                      </Pill>
                    </td>
                    <td className="py-1.5 px-2" style={{ color: "var(--sab-ink2)" }}>
                      {v.assignedTo?.name ?? "—"}
                    </td>
                    <td className="py-1.5 px-2 sab-code" style={{ fontSize: 11 }}>
                      {v.completedAt ? fmtDate(v.completedAt) : "—"}
                    </td>
                  </tr>
                ))}
                {amc.visits.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-[12px]" style={{ color: "var(--sab-ink3)" }}>
                      No visits yet — approve the contract to pre-generate the schedule.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section
            className="rounded border p-4"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
          >
            <h3 className="text-sm font-semibold mb-2">Invoices</h3>
            {amc.invoices.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--sab-ink3)" }}>
                No invoices yet.
              </p>
            ) : (
              <ul className="text-[12.5px] grid gap-1">
                {amc.invoices.map((inv) => (
                  <li key={inv.id} className="flex justify-between">
                    <Link href={`/invoices/${inv.id}`} className="underline">
                      <Code>{inv.invoiceNo}</Code> · {inv.kind} · {inv.status}
                    </Link>
                    <span className="font-mono">{inr(Number(inv.grandTotal))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="grid gap-4">
          {canManage && (
            <section
              className="rounded border p-4"
              style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
            >
              <h3 className="text-sm font-semibold mb-2">Actions</h3>
              <AMCActions
                amcId={amc.id}
                status={amc.status}
                onApprove={handleApprove}
                onHold={handleHold}
                onResume={handleResume}
                onCancel={handleCancel}
                onRenew={handleRenew}
              />
            </section>
          )}

          <section
            className="rounded border p-4"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
          >
            <h3 className="text-sm font-semibold mb-2">SLA matrix</h3>
            <table className="w-full text-[12px]">
              <tbody>
                {amc.slas.map((s) => (
                  <tr key={s.priority}>
                    <td className="font-mono py-1">{s.priority}</td>
                    <td className="py-1" style={{ color: "var(--sab-ink2)" }}>
                      respond {s.responseHours}h · resolve {s.resolutionHours}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <div className="sab-caps" style={{ color: "var(--sab-ink3)", fontSize: 10 }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

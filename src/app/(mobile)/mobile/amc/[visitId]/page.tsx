import Link from "next/link";
import { notFound } from "next/navigation";
import { AMCVisitStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { completeAMCVisit, startAMCVisit } from "@/server/actions/amc-visits";
import { formatIST } from "@/lib/time";
import { Code } from "@/components/sab/Code";
import { Pill } from "@/components/sab";
import { MobileAMCVisitForm } from "./MobileAMCVisitForm";

type CheckItem = { item: string; ok: boolean; note?: string };

const VISIT_TONE: Record<AMCVisitStatus, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  SCHEDULED: "blue",
  IN_PROGRESS: "amber",
  COMPLETED: "positive",
  MISSED: "alert",
  CANCELLED: "ink",
};

export default async function MobileAMCVisitPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  await requireSession();
  const { visitId } = await params;

  const visit = await db.aMCVisit.findUnique({
    where: { id: visitId },
    include: {
      amc: {
        select: {
          id: true,
          contractNo: true,
          title: true,
          siteAddress: true,
          billingMode: true,
          assetsCovered: true,
        },
      },
      assignedTo: { select: { name: true } },
    },
  });
  if (!visit) notFound();

  const defaultChecklist = (visit.checklist as unknown as CheckItem[] | null) ?? undefined;

  async function onStart(id: string) {
    "use server";
    await startAMCVisit(id);
  }
  async function onComplete(id: string, raw: unknown) {
    "use server";
    await completeAMCVisit(id, raw);
  }

  const readOnly =
    visit.status === AMCVisitStatus.COMPLETED ||
    visit.status === AMCVisitStatus.CANCELLED ||
    visit.status === AMCVisitStatus.MISSED;

  return (
    <div className="pb-6">
      <div className="px-5 pb-3 pt-4">
        <Link
          href="/mobile/amc"
          className="font-sab-mono text-[11px]"
          style={{ color: "var(--sab-ink3)", textDecoration: "none" }}
        >
          ← Back to visits
        </Link>
        <div className="sab-eyebrow text-sab-ink-3 mt-2">
          <Code>{visit.amc.contractNo}</Code> · visit #{visit.visitNo}
        </div>
        <h1 className="mt-1 font-sab-sans text-[19px] font-semibold tracking-[-0.025em]">
          {visit.amc.title}
        </h1>
        <div className="mt-1 font-sab-sans text-[12.5px]" style={{ color: "var(--sab-ink2)" }}>
          {visit.amc.siteAddress}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Pill tone={VISIT_TONE[visit.status]} size="sm">
            {visit.status}
          </Pill>
          <div className="font-sab-mono text-[11px]" style={{ color: "var(--sab-ink3)" }}>
            {formatIST(visit.scheduledDate, "EEE dd MMM yyyy")}
          </div>
        </div>
        {visit.assignedTo && (
          <div className="mt-1 font-sab-sans text-[11.5px]" style={{ color: "var(--sab-ink3)" }}>
            Assigned to {visit.assignedTo.name}
          </div>
        )}
      </div>

      <div className="px-4">
        {readOnly ? (
          <div
            className="rounded border p-4 text-[13px]"
            style={{
              borderColor: "hsl(var(--border))",
              background: "hsl(var(--card))",
            }}
          >
            <div className="font-semibold mb-1">Visit locked</div>
            <p style={{ color: "var(--sab-ink2)" }}>
              This visit is {visit.status.toLowerCase()} and can no longer be edited.
            </p>
            {visit.findings && (
              <div className="mt-3">
                <div className="sab-caps" style={{ color: "var(--sab-ink3)", fontSize: 10 }}>
                  Findings
                </div>
                <div className="mt-1">{visit.findings}</div>
              </div>
            )}
          </div>
        ) : (
          <MobileAMCVisitForm
            visitId={visit.id}
            billingMode={visit.amc.billingMode}
            defaultChecklist={defaultChecklist}
            onStart={onStart}
            onComplete={onComplete}
          />
        )}
      </div>
    </div>
  );
}

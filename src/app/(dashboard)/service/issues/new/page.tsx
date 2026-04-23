import { redirect } from "next/navigation";
import { AMCStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { createServiceIssue } from "@/server/actions/service-issues";
import { PageHeader } from "@/components/sab";
import { ServiceIssueIntakeForm } from "../ServiceIssueIntakeForm";

export default async function NewServiceIssuePage() {
  await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR, Role.EMPLOYEE]);

  const [clients, projects, amcs] = await Promise.all([
    db.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
    db.aMC.findMany({
      where: { status: AMCStatus.ACTIVE },
      orderBy: { contractNo: "asc" },
      select: { id: true, contractNo: true, title: true, clientId: true },
    }),
  ]);

  async function handle(raw: unknown) {
    "use server";
    const result = await createServiceIssue(raw);
    redirect(`/service/issues/${result.issueId}`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="After-sales · New"
        title="Log a service call"
        description="Intake a reactive issue. Triage (priority + coverage + SLA) happens next."
      />
      <ServiceIssueIntakeForm
        clients={clients}
        projects={projects}
        amcs={amcs}
        onSubmit={handle}
      />
    </div>
  );
}

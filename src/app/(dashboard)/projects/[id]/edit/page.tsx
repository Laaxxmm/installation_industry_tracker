import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { requireRole } from "@/server/rbac";
import { db } from "@/server/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewProjectForm } from "../../new/NewProjectForm";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { id } = await params;

  const [project, supervisors] = await Promise.all([
    db.project.findUnique({ where: { id } }),
    db.user.findMany({
      where: { role: Role.SUPERVISOR, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!project) notFound();

  const toDateInput = (d: Date | null) =>
    d ? d.toISOString().slice(0, 10) : "";

  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow={project.code}
        title="Edit project"
        description="Updates all editable project fields. Status is changed separately."
      />
      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>Saving redirects back to the project.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewProjectForm
            supervisors={supervisors}
            projectId={project.id}
            initial={{
              name: project.name,
              clientName: project.clientName,
              contractValue: project.contractValue.toString(),
              startDate: toDateInput(project.startDate),
              siteSupervisorId: project.siteSupervisorId ?? "",
              fileNo: project.fileNo ?? "",
              poNumber: project.poNumber ?? "",
              poDate: toDateInput(project.poDate),
              poStatus: project.poStatus ?? "",
              location: project.location ?? "",
              description: project.description ?? "",
              projectDetails: project.projectDetails ?? "",
              workStatus: project.workStatus ?? "",
              billedValue: project.billedValue.toString(),
              adjBillableValue: project.adjBillableValue.toString(),
              response: project.response ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

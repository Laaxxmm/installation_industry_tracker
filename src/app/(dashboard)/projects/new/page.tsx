import { Role } from "@prisma/client";
import { requireRole } from "@/server/rbac";
import { db } from "@/server/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProjectPage() {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const supervisors = await db.user.findMany({
    where: { role: Role.SUPERVISOR, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="New"
        title="Create project"
        description="Code is auto-generated as SAB-YYYY-####."
      />
      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>
            You can edit budget lines after creating.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewProjectForm supervisors={supervisors} />
        </CardContent>
      </Card>
    </div>
  );
}

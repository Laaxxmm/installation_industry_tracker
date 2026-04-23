import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { createAMC } from "@/server/actions/amcs";
import { PageHeader } from "@/components/sab";
import { AMCForm } from "../AMCForm";

export default async function NewAMCPage() {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const [clients, projects] = await Promise.all([
    db.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ]);

  async function handle(raw: unknown) {
    "use server";
    const result = await createAMC(raw);
    redirect(`/amcs/${result.amcId}`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="After-sales · New"
        title="New AMC contract"
        description="Draft a contract. Visits are auto-generated when you approve."
      />
      <AMCForm clients={clients} projects={projects} onSubmit={handle} />
    </div>
  );
}

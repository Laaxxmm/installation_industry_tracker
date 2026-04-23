import { Role } from "@prisma/client";
import Link from "next/link";
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
import { sabStateCode } from "@/lib/org";
import { NewQuoteForm } from "./NewQuoteForm";

export default async function NewQuotePage() {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const clients = await db.client.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, stateCode: true, gstin: true },
  });

  if (clients.length === 0) {
    return (
      <div className="max-w-2xl">
        <PageHeader
          eyebrow="New"
          title="Create quote"
          description="You need at least one client before you can quote."
        />
        <Card>
          <CardContent>
            <p className="text-[13px] text-slate-600">
              No clients yet.{" "}
              <Link href="/clients/new" className="text-brand hover:underline">
                Add a client
              </Link>{" "}
              first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="New"
        title="Create quote"
        description="Number is auto-assigned as SAB-Q-YYYY-####. GST is computed live from your SAB_STATE_CODE vs the client's place-of-supply."
      />
      <Card>
        <CardHeader>
          <CardTitle>Quote details</CardTitle>
          <CardDescription>
            Starts in DRAFT. Send once ready to generate the shareable link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewQuoteForm clients={clients} supplierStateCode={sabStateCode()} />
        </CardContent>
      </Card>
    </div>
  );
}

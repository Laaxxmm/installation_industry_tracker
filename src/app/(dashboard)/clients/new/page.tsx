import { Role } from "@prisma/client";
import { requireRole } from "@/server/rbac";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "../ClientForm";

export default async function NewClientPage() {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="New"
        title="Add client"
        description="Capture GSTIN and place-of-supply state so GST math runs automatically on quotes and invoices."
      />
      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
          <CardDescription>
            GSTIN and PAN are optional. Clients without GSTIN are treated as unregistered for GST.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}

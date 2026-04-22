import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { PurchaseOrderDocument } from "@/server/pdf/po-pdf";
import { pdfResponse } from "@/server/pdf/render";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { id } = await params;

  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { project: { select: { code: true, name: true } } },
  });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return pdfResponse(
    <PurchaseOrderDocument
      po={po}
      projectCode={po.project.code}
      projectName={po.project.name}
    />,
    `${po.poNo}.pdf`,
  );
}

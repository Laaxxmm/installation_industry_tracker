import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { TaxInvoiceDocument } from "@/server/pdf/invoice-pdf";
import { pdfResponse } from "@/server/pdf/render";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { id } = await params;

  const invoice = await db.clientInvoice.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return pdfResponse(
    <TaxInvoiceDocument invoice={invoice} />,
    `${invoice.invoiceNo}.pdf`,
  );
}

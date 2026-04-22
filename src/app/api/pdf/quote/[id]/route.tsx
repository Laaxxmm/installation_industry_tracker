import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { QuoteDocument } from "@/server/pdf/quote-pdf";
import { pdfResponse } from "@/server/pdf/render";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { id } = await params;

  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return pdfResponse(
    <QuoteDocument quote={quote} />,
    `${quote.quoteNo}.pdf`,
  );
}

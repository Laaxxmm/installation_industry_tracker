import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { getProjectPnl, defaultRangeForProject } from "@/server/actions/pnl";
import { toDecimal } from "@/lib/money";
import { formatIST } from "@/lib/time";
import type { ProjectPnl } from "@/lib/pnl";

type Params = { params: Promise<{ kind: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { kind } = await params;
  const url = new URL(req.url);

  if (kind === "project-pnl") {
    return projectPnlXlsx(url);
  }
  if (kind === "portfolio") {
    return portfolioXlsx(url);
  }
  return NextResponse.json({ error: "Unknown export kind" }, { status: 400 });
}

async function projectPnlXlsx(url: URL) {
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const defaultRange = defaultRangeForProject(project.startDate, project.endDate);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const range = {
    from: fromStr ? new Date(fromStr) : defaultRange.from,
    to: toStr ? new Date(toStr) : defaultRange.to,
  };
  const pnl = await getProjectPnl(projectId, range);

  const wb = new ExcelJS.Workbook();
  wb.creator = "SAB India Tracker";
  wb.created = new Date();

  // P&L sheet
  const pnlSheet = wb.addWorksheet("P&L");
  pnlSheet.columns = [
    { header: "Line", key: "line", width: 40 },
    { header: "Amount (INR)", key: "amount", width: 18 },
  ];
  const overrideNum = pnl.materialOverride
    ? Number(pnl.materialOverride.toString())
    : 0;
  const directMaterialsNum = Number(pnl.directMaterial.toString()) - overrideNum;

  const pnlRows: Array<[string, string | number]> = [
    ["Project code", project.code],
    ["Project name", project.name],
    ["Client", project.clientName],
    ["Range from", formatIST(range.from, "yyyy-MM-dd")],
    ["Range to", formatIST(range.to, "yyyy-MM-dd")],
    ["", ""],
    ["Revenue (invoices)", Number(pnl.revenue.toString())],
    ["  Direct labor — hourly", Number(pnl.directLaborHourly.toString())],
    ["  Direct labor — salaried (allocated)", Number(pnl.directLaborSalaried.toString())],
    ["Direct labor total", Number(pnl.directLabor.toString())],
    ["  Direct materials", directMaterialsNum],
    ["  Direct other", overrideNum],
    ["Direct material total", Number(pnl.directMaterial.toString())],
    ["Other direct costs", Number(pnl.directOther.toString())],
    ["Contribution margin", Number(pnl.contributionMargin.toString())],
    ["Overhead allocated", Number(pnl.overhead.toString())],
    ["Net P&L", Number(pnl.netPnl.toString())],
  ];
  pnlRows.forEach((r) => pnlSheet.addRow({ line: r[0], amount: r[1] }));
  pnlSheet.getColumn(2).numFmt = '#,##0.00;[Red]-#,##0.00';
  pnlSheet.getRow(1).font = { bold: true };

  // Variance sheet
  const varSheet = wb.addWorksheet("Variance");
  varSheet.columns = [
    { header: "Category", key: "cat", width: 15 },
    { header: "Budget", key: "budget", width: 15 },
    { header: "Actual", key: "actual", width: 15 },
    { header: "Variance", key: "variance", width: 15 },
    { header: "%", key: "pct", width: 10 },
  ];
  (["material", "labor", "other"] as const).forEach((cat) => {
    const v = pnl.variance[cat];
    varSheet.addRow({
      cat: cat.toUpperCase(),
      budget: Number(v.budget.toString()),
      actual: Number(v.actual.toString()),
      variance: Number(v.variance.toString()),
      pct: v.variancePct ? Number(v.variancePct.toString()) : null,
    });
  });
  varSheet.getColumn(2).numFmt = '#,##0.00';
  varSheet.getColumn(3).numFmt = '#,##0.00';
  varSheet.getColumn(4).numFmt = '#,##0.00;[Red]-#,##0.00';
  varSheet.getColumn(5).numFmt = '0.00"%"';
  varSheet.getRow(1).font = { bold: true };

  // Ledger sheet
  const ledgerSheet = wb.addWorksheet("Ledger");
  ledgerSheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Type", key: "kind", width: 18 },
    { header: "Description", key: "desc", width: 50 },
    { header: "Amount", key: "amount", width: 15 },
  ];

  const [invoices, stockIssues, directPurchases, overheads, transfers] = await Promise.all([
    db.invoice.findMany({
      where: {
        projectId,
        issuedAt: { gte: range.from, lt: range.to },
      },
      orderBy: { issuedAt: "asc" },
    }),
    db.stockIssue.findMany({
      where: {
        projectId,
        issuedAt: { gte: range.from, lt: range.to },
      },
      include: { material: true },
      orderBy: { issuedAt: "asc" },
    }),
    db.directPurchase.findMany({
      where: {
        projectId,
        purchasedAt: { gte: range.from, lt: range.to },
      },
      orderBy: { purchasedAt: "asc" },
    }),
    db.overheadAllocation.findMany({
      where: {
        projectId,
        periodMonth: { gte: range.from, lt: range.to },
      },
      orderBy: { periodMonth: "asc" },
    }),
    db.materialTransfer.findMany({
      where: {
        transferredAt: { gte: range.from, lt: range.to },
        OR: [{ fromProjectId: projectId }, { toProjectId: projectId }],
      },
      include: { material: true, fromProject: true, toProject: true },
      orderBy: { transferredAt: "asc" },
    }),
  ]);

  for (const inv of invoices) {
    ledgerSheet.addRow({
      date: formatIST(inv.issuedAt, "yyyy-MM-dd"),
      kind: "Invoice",
      desc: `${inv.invoiceNo}${inv.note ? ` — ${inv.note}` : ""}`,
      amount: Number(toDecimal(inv.amount).toString()),
    });
  }
  for (const si of stockIssues) {
    const total = toDecimal(si.qty).times(toDecimal(si.unitCostAtIssue));
    ledgerSheet.addRow({
      date: formatIST(si.issuedAt, "yyyy-MM-dd"),
      kind: "Stock issue",
      desc: `${si.material.sku} — ${si.qty.toString()} ${si.material.unit}`,
      amount: -Number(total.toString()),
    });
  }
  for (const dp of directPurchases) {
    ledgerSheet.addRow({
      date: formatIST(dp.purchasedAt, "yyyy-MM-dd"),
      kind: "Direct purchase",
      desc: `${dp.description} [${dp.category}]`,
      amount: -Number(toDecimal(dp.total).toString()),
    });
  }
  for (const oh of overheads) {
    ledgerSheet.addRow({
      date: formatIST(oh.periodMonth, "yyyy-MM"),
      kind: "Overhead",
      desc: oh.note ?? "",
      amount: -Number(toDecimal(oh.amount).toString()),
    });
  }
  for (const t of transfers) {
    const total = toDecimal(t.qty).times(toDecimal(t.unitCostAtTransfer));
    const isIn = t.toProjectId === projectId;
    ledgerSheet.addRow({
      date: formatIST(t.transferredAt, "yyyy-MM-dd"),
      kind: isIn ? "Transfer in" : "Transfer out",
      desc: `${t.material.sku} — ${t.qty.toString()} ${t.material.unit} ${
        isIn ? `from ${t.fromProject.code}` : `to ${t.toProject.code}`
      }`,
      amount: isIn
        ? -Number(total.toString())
        : Number(total.toString()),
    });
  }
  ledgerSheet.getColumn(4).numFmt = '#,##0.00;[Red]-#,##0.00';
  ledgerSheet.getRow(1).font = { bold: true };

  return xlsxResponse(wb, `${project.code}-pnl`);
}

async function portfolioXlsx(url: URL) {
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const hasRange = fromStr || toStr;
  const from = fromStr ? new Date(fromStr) : new Date("2020-01-01T00:00:00Z");
  const to = toStr ? new Date(toStr) : new Date(Date.now() + 365 * 24 * 3600 * 1000);

  const projects = await db.project.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      clientName: true,
      status: true,
      contractValue: true,
      startDate: true,
      endDate: true,
      materialsSupplied: true,
    },
  });

  const rows: Array<{
    project: (typeof projects)[number];
    pnl: ProjectPnl;
    material: ProjectPnl["directMaterial"];
    contribution: ProjectPnl["directMaterial"];
    netPnl: ProjectPnl["directMaterial"];
  }> = await Promise.all(
    projects.map(async (p) => {
      const pnl = await getProjectPnl(
        p.id,
        hasRange ? { from, to } : defaultRangeForProject(p.startDate, p.endDate),
      );
      // directMaterial already includes the project-level materialsSupplied override.
      return {
        project: p,
        pnl,
        material: pnl.directMaterial,
        contribution: pnl.contributionMargin,
        netPnl: pnl.netPnl,
      };
    }),
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "SAB India Tracker";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Portfolio");
  sheet.columns = [
    { header: "Code", key: "code", width: 16 },
    { header: "Name", key: "name", width: 30 },
    { header: "Client", key: "client", width: 20 },
    { header: "Status", key: "status", width: 12 },
    { header: "Contract", key: "contract", width: 15 },
    { header: "Revenue", key: "revenue", width: 15 },
    { header: "Labor", key: "labor", width: 15 },
    { header: "Material", key: "material", width: 15 },
    { header: "Other", key: "other", width: 15 },
    { header: "Contribution", key: "contribution", width: 15 },
    { header: "Overhead", key: "overhead", width: 15 },
    { header: "Net P&L", key: "net", width: 15 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach(({ project, pnl, material, contribution, netPnl }) => {
    sheet.addRow({
      code: project.code,
      name: project.name,
      client: project.clientName,
      status: project.status,
      contract: Number(toDecimal(project.contractValue).toString()),
      revenue: Number(pnl.revenue.toString()),
      labor: Number(pnl.directLabor.toString()),
      material: Number(material.toString()),
      other: Number(pnl.directOther.toString()),
      contribution: Number(contribution.toString()),
      overhead: Number(pnl.overhead.toString()),
      net: Number(netPnl.toString()),
    });
  });

  [5, 6, 7, 8, 9, 10, 11].forEach((c) => {
    sheet.getColumn(c).numFmt = '#,##0.00';
  });
  sheet.getColumn(12).numFmt = '#,##0.00;[Red]-#,##0.00';

  return xlsxResponse(wb, "portfolio-pnl");
}

async function xlsxResponse(
  wb: ExcelJS.Workbook,
  filenameStem: string,
): Promise<NextResponse> {
  const buffer = await wb.xlsx.writeBuffer();
  const stamp = formatIST(new Date(), "yyyyMMdd-HHmm");
  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameStem}-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

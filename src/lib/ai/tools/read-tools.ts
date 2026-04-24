import { tool } from "ai";
import { z } from "zod";
import {
  AMCVisitStatus,
  InvoiceKind,
  InvoiceStatus,
  QuoteStatus,
  Role,
  ServicePriority,
  ServiceStatus,
  VendorPOStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "@/server/db";
import type { Session } from "next-auth";

// Read-only tool registry used by the Phase 1 chat assistant. Each tool is a
// thin wrapper around a Prisma query; role checks are performed per-tool
// against the caller's session (passed in by the route handler). No tool
// mutates state — writes arrive in Phase 2.

interface Ctx {
  session: Session;
}

function isManagerPlus(session: Session): boolean {
  return session.user.role === Role.ADMIN || session.user.role === Role.MANAGER;
}

function requireManager(session: Session) {
  if (!isManagerPlus(session)) {
    throw new Error("This query requires MANAGER or ADMIN role.");
  }
}

function redactPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return `••• ${digits.slice(-4)}`;
}

function redactGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  return `${gstin.slice(0, 2)}•••${gstin.slice(-2)}`;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function buildReadTools({ session }: Ctx) {
  return {
    listOverdueInvoices: tool({
      description:
        "List ISSUED client invoices that are past their due date. Returns invoice number, client name, grand total, due date, and days overdue. Requires MANAGER or ADMIN role.",
      parameters: z.object({
        clientId: z.string().optional().describe("Optional Client ID to filter by."),
        kind: z
          .enum([
            "ADVANCE",
            "PROGRESS",
            "FINAL",
            "ADHOC",
            "AMC_CONTRACT",
            "AMC_INSTALLMENT",
            "SERVICE_CALL",
          ])
          .optional()
          .describe("Optional InvoiceKind filter."),
        olderThanDays: z
          .number()
          .int()
          .min(0)
          .max(365)
          .default(30)
          .describe("Only invoices whose dueAt is more than this many days past."),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async (args) => {
        requireManager(session);
        const cutoff = new Date(Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000);
        const where: Prisma.ClientInvoiceWhereInput = {
          status: InvoiceStatus.ISSUED,
          dueAt: { lt: cutoff, not: null },
        };
        if (args.clientId) where.clientId = args.clientId;
        if (args.kind) where.kind = args.kind as InvoiceKind;

        const rows = await db.clientInvoice.findMany({
          where,
          take: args.limit,
          orderBy: { dueAt: "asc" },
          include: { client: { select: { name: true } } },
        });
        const now = new Date();
        return {
          count: rows.length,
          invoices: rows.map((r) => ({
            invoiceNo: r.invoiceNo,
            clientName: r.client.name,
            kind: r.kind,
            grandTotal: r.grandTotal.toString(),
            amountPaid: r.amountPaid.toString(),
            dueAt: r.dueAt?.toISOString() ?? null,
            daysOverdue: r.dueAt ? daysBetween(r.dueAt, now) : null,
          })),
        };
      },
    }),

    projectSummary: tool({
      description:
        "Summarise a project: status, contract / billed value, supervisor, open service issues, and stage progress. Accepts the project code or ID.",
      parameters: z.object({
        projectCodeOrId: z
          .string()
          .describe("Project code (e.g. 'SAB-26-0041') or raw Prisma ID."),
      }),
      execute: async ({ projectCodeOrId }) => {
        const project = await db.project.findFirst({
          where: {
            OR: [{ code: projectCodeOrId }, { id: projectCodeOrId }],
          },
          include: {
            client: { select: { name: true } },
            siteSupervisor: { select: { name: true } },
            stages: true,
            _count: {
              select: {
                serviceIssues: {
                  where: {
                    status: { notIn: [ServiceStatus.CLOSED, ServiceStatus.CANCELLED] },
                  },
                },
              },
            },
          },
        });
        if (!project) return { found: false as const };
        return {
          found: true as const,
          code: project.code,
          name: project.name,
          clientName: project.client?.name ?? project.clientName,
          status: project.status,
          contractValue: project.contractValue.toString(),
          billedValue: project.billedValue.toString(),
          startDate: project.startDate?.toISOString() ?? null,
          endDate: project.endDate?.toISOString() ?? null,
          siteSupervisor: project.siteSupervisor?.name ?? null,
          openServiceIssueCount: project._count.serviceIssues,
          stages: project.stages.map((s) => ({
            stage: s.stageKey,
            plannedStart: s.plannedStart?.toISOString() ?? null,
            plannedEnd: s.plannedEnd?.toISOString() ?? null,
            actualStart: s.actualStart?.toISOString() ?? null,
            actualEnd: s.actualEnd?.toISOString() ?? null,
          })),
        };
      },
    }),

    serviceIssueLookup: tool({
      description:
        "Search service tickets (issues) by ticket number, client, status, priority, or SLA breach. Returns ticket number, summary, status, priority, client, project, and SLA state.",
      parameters: z.object({
        ticketNoOrId: z
          .string()
          .optional()
          .describe("Exact ticket number (e.g. 'SR-25-26-0231') or ID."),
        clientId: z.string().optional(),
        status: z
          .enum([
            "NEW",
            "TRIAGED",
            "ASSIGNED",
            "IN_PROGRESS",
            "ON_HOLD",
            "RESOLVED",
            "VERIFIED",
            "CLOSED",
            "CANCELLED",
          ])
          .optional(),
        priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
        onlySlaBreached: z.boolean().default(false),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      execute: async (args) => {
        const where: Prisma.ServiceIssueWhereInput = {};
        if (args.ticketNoOrId) {
          where.OR = [{ ticketNo: args.ticketNoOrId }, { id: args.ticketNoOrId }];
        }
        if (args.clientId) where.clientId = args.clientId;
        if (args.status) where.status = args.status as ServiceStatus;
        if (args.priority) where.priority = args.priority as ServicePriority;
        if (args.onlySlaBreached) where.slaBreachedAt = { not: null };

        const rows = await db.serviceIssue.findMany({
          where,
          take: args.limit,
          orderBy: { reportedAt: "desc" },
          include: {
            client: { select: { name: true } },
            project: { select: { code: true } },
          },
        });
        return {
          count: rows.length,
          issues: rows.map((r) => ({
            ticketNo: r.ticketNo,
            summary: r.summary,
            status: r.status,
            priority: r.priority,
            coverage: r.coverage,
            clientName: r.client.name,
            projectCode: r.project.code,
            reportedAt: r.reportedAt.toISOString(),
            resolutionDueAt: r.resolutionDueAt?.toISOString() ?? null,
            slaBreachedAt: r.slaBreachedAt?.toISOString() ?? null,
          })),
        };
      },
    }),

    amcVisitsThisWeek: tool({
      description:
        "List AMC preventive-maintenance visits scheduled in the next 7 days. Optional filter by status or 'assigned to me'.",
      parameters: z.object({
        assignedToMe: z
          .boolean()
          .default(false)
          .describe("Only return visits assigned to the calling user."),
        status: z
          .enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "MISSED", "CANCELLED"])
          .optional(),
        limit: z.number().int().min(1).max(50).default(25),
      }),
      execute: async (args) => {
        const now = new Date();
        const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const where: Prisma.AMCVisitWhereInput = {
          scheduledDate: { gte: now, lte: in7d },
        };
        if (args.status) where.status = args.status as AMCVisitStatus;
        if (args.assignedToMe) where.assignedToUserId = session.user.id;

        const rows = await db.aMCVisit.findMany({
          where,
          take: args.limit,
          orderBy: { scheduledDate: "asc" },
          include: {
            amc: { include: { client: { select: { name: true } } } },
            assignedTo: { select: { name: true } },
          },
        });
        return {
          count: rows.length,
          visits: rows.map((v) => ({
            contractNo: v.amc.contractNo,
            clientName: v.amc.client.name,
            visitNo: v.visitNo,
            scheduledDate: v.scheduledDate.toISOString(),
            status: v.status,
            assignedTo: v.assignedTo?.name ?? null,
          })),
        };
      },
    }),

    stockOnHand: tool({
      description:
        "List inventory materials with current on-hand quantity and average unit cost. Supports SKU/name search and a low-stock threshold.",
      parameters: z.object({
        query: z
          .string()
          .optional()
          .describe("Match against material SKU or name (case-insensitive)."),
        lowStockBelow: z
          .number()
          .optional()
          .describe("Only return materials with onHandQty less than this."),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: async (args) => {
        const where: Prisma.MaterialWhereInput = { active: true };
        if (args.query) {
          where.OR = [
            { sku: { contains: args.query, mode: "insensitive" } },
            { name: { contains: args.query, mode: "insensitive" } },
          ];
        }
        const rows = await db.material.findMany({
          where,
          take: args.limit,
          orderBy: { name: "asc" },
          select: {
            sku: true,
            name: true,
            unit: true,
            onHandQty: true,
            avgUnitCost: true,
          },
        });
        const filtered =
          args.lowStockBelow != null
            ? rows.filter((m) => Number(m.onHandQty) < args.lowStockBelow!)
            : rows;
        return {
          count: filtered.length,
          materials: filtered.map((m) => ({
            sku: m.sku,
            name: m.name,
            unit: m.unit,
            onHandQty: m.onHandQty.toString(),
            avgUnitCost: m.avgUnitCost.toString(),
          })),
        };
      },
    }),

    vendorPOStatus: tool({
      description:
        "List vendor purchase orders with status and expected delivery. Filter by vendor name/code or status. Requires MANAGER or ADMIN role.",
      parameters: z.object({
        vendorQuery: z.string().optional().describe("Match vendor name or code."),
        status: z
          .enum([
            "DRAFT",
            "PENDING_APPROVAL",
            "APPROVED",
            "SENT",
            "PARTIALLY_RECEIVED",
            "RECEIVED",
            "CLOSED",
            "CANCELLED",
          ])
          .optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async (args) => {
        requireManager(session);
        const where: Prisma.VendorPOWhereInput = {};
        if (args.status) where.status = args.status as VendorPOStatus;
        if (args.vendorQuery) {
          where.vendor = {
            OR: [
              { name: { contains: args.vendorQuery, mode: "insensitive" } },
              { code: { contains: args.vendorQuery, mode: "insensitive" } },
            ],
          };
        }
        const rows = await db.vendorPO.findMany({
          where,
          take: args.limit,
          orderBy: { issueDate: "desc" },
          include: { vendor: { select: { name: true, code: true } } },
        });
        return {
          count: rows.length,
          pos: rows.map((po) => ({
            poNo: po.poNo,
            vendorName: po.vendor.name,
            vendorCode: po.vendor.code,
            status: po.status,
            grandTotal: po.grandTotal.toString(),
            issueDate: po.issueDate.toISOString(),
            expectedDate: po.expectedDate?.toISOString() ?? null,
          })),
        };
      },
    }),

    quotePipeline: tool({
      description:
        "List quotes in the sales pipeline with status, client, grand total, and timestamps. Optional filter by client or status.",
      parameters: z.object({
        clientId: z.string().optional(),
        status: z
          .enum([
            "DRAFT",
            "SENT",
            "CHANGES_REQUESTED",
            "REVISED",
            "NEGOTIATING",
            "ACCEPTED",
            "CONVERTED",
            "LOST",
            "EXPIRED",
          ])
          .optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async (args) => {
        const where: Prisma.QuoteWhereInput = {};
        if (args.clientId) where.clientId = args.clientId;
        if (args.status) where.status = args.status as QuoteStatus;
        const rows = await db.quote.findMany({
          where,
          take: args.limit,
          orderBy: { updatedAt: "desc" },
          include: { client: { select: { name: true } } },
        });
        return {
          count: rows.length,
          quotes: rows.map((q) => ({
            quoteNo: q.quoteNo,
            title: q.title,
            clientName: q.client.name,
            status: q.status,
            grandTotal: q.grandTotal.toString(),
            sentAt: q.sentAt?.toISOString() ?? null,
            updatedAt: q.updatedAt.toISOString(),
          })),
        };
      },
    }),

    clientLookup: tool({
      description:
        "Search clients by name. Returns Client ID, name, contact summary (PII redacted), active-project count.",
      parameters: z.object({
        query: z
          .string()
          .min(1)
          .describe("Match against client name (case-insensitive)."),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async (args) => {
        const rows = await db.client.findMany({
          where: {
            active: true,
            name: { contains: args.query, mode: "insensitive" },
          },
          take: args.limit,
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: {
                projects: {
                  where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
                },
              },
            },
          },
        });
        return {
          count: rows.length,
          clients: rows.map((c) => ({
            id: c.id,
            name: c.name,
            gstin: redactGstin(c.gstin),
            contactName: c.contactName,
            phone: redactPhone(c.phone),
            stateCode: c.stateCode,
            activeProjectCount: c._count.projects,
          })),
        };
      },
    }),
  };
}

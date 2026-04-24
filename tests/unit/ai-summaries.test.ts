import { describe, expect, it } from "vitest";
import {
  buildServiceIssueSummaryPrompt,
  buildProjectSummaryPrompt,
  fetchServiceIssueSummaryContext,
  fetchProjectSummaryContext,
} from "@/lib/ai/summaries";

type ServiceCtx = NonNullable<
  Awaited<ReturnType<typeof fetchServiceIssueSummaryContext>>
>;
type ProjectCtx = NonNullable<
  Awaited<ReturnType<typeof fetchProjectSummaryContext>>
>;

const serviceCtx = {
  ticketNo: "T-2026-0001",
  summary: "Leak at sprinkler head near pump room",
  description: "Water dripping at 2am, client logged via WhatsApp",
  category: "LEAK",
  priority: "P2",
  coverage: "BILLABLE",
  status: "IN_PROGRESS",
  reportedAt: new Date("2026-04-20T08:30:00Z"),
  firstResponseAt: new Date("2026-04-20T10:00:00Z"),
  resolvedAt: null,
  slaBreachedAt: null,
  onHoldCumulativeMinutes: 45,
  billableAmount: "12500",
  siteAddress: "Basement level 2, Apollo Hospital",
  client: { name: "Apollo Hospital" },
  project: { code: "P-001", name: "Basement retrofit" },
  amc: null,
  assignedTo: { name: "Ravi K." },
  visits: [
    {
      arrivedAt: new Date("2026-04-20T11:00:00Z"),
      completedAt: new Date("2026-04-20T12:30:00Z"),
      workPerformed: "Isolated riser, replaced flange gasket",
      findings: "Corroded seal — needs pressure test",
      assignedTo: { name: "Ravi K." },
    },
  ],
} as unknown as ServiceCtx;

describe("buildServiceIssueSummaryPrompt", () => {
  it("asks for 3-5 sentences and no markdown", () => {
    const { system } = buildServiceIssueSummaryPrompt(serviceCtx);
    expect(system).toMatch(/3-5 short sentences/i);
    expect(system).toMatch(/no markdown/i);
  });

  it("includes data-not-instructions framing", () => {
    const { system } = buildServiceIssueSummaryPrompt(serviceCtx);
    expect(system).toMatch(/data, not an instruction/i);
  });

  it("surfaces ticket number, client, project, and visit findings", () => {
    const { prompt } = buildServiceIssueSummaryPrompt(serviceCtx);
    expect(prompt).toContain("T-2026-0001");
    expect(prompt).toContain("Apollo Hospital");
    expect(prompt).toContain("P-001");
    expect(prompt).toContain("Corroded seal");
    expect(prompt).toContain("Ravi K.");
  });

  it("flags SLA status when unbreached", () => {
    const { prompt } = buildServiceIssueSummaryPrompt(serviceCtx);
    expect(prompt).toContain("SLA on track");
  });

  it("flags SLA breach when slaBreachedAt is set", () => {
    const { prompt } = buildServiceIssueSummaryPrompt({
      ...serviceCtx,
      slaBreachedAt: new Date("2026-04-21T09:00:00Z"),
    });
    expect(prompt).toContain("SLA BREACHED");
  });

  it("handles tickets with no visits", () => {
    const { prompt } = buildServiceIssueSummaryPrompt({
      ...serviceCtx,
      visits: [],
    });
    expect(prompt).toContain("Visits:");
    expect(prompt).toContain("(none)");
  });
});

const projectCtx = {
  id: "p1",
  code: "P-001",
  name: "Basement retrofit",
  startDate: new Date("2026-01-10T00:00:00Z"),
  endDate: new Date("2026-06-30T00:00:00Z"),
  workStatus: "IN_PROGRESS",
  client: { name: "Apollo Hospital" },
  purchaseOrder: {
    amount: "1000000",
    status: "ACTIVE",
    poNo: "WO-2026-001",
  },
  milestones: [
    {
      name: "Rough-in",
      stageKey: "ROUGH_IN",
      plannedStart: new Date("2026-01-15T00:00:00Z"),
      plannedEnd: new Date("2026-03-15T00:00:00Z"),
      status: "COMPLETED",
      percentComplete: 100,
    },
    {
      name: "Testing",
      stageKey: "TESTING",
      plannedStart: new Date("2026-03-16T00:00:00Z"),
      plannedEnd: new Date("2026-05-15T00:00:00Z"),
      status: "IN_PROGRESS",
      percentComplete: 40,
    },
  ],
  clientInvoices: [
    {
      invoiceNo: "INV-0001",
      kind: "PROGRESS",
      status: "ISSUED",
      grandTotal: "300000",
    },
  ],
  serviceIssues: [
    { ticketNo: "T-2026-0001", priority: "P2", summary: "Leak at sprinkler" },
  ],
} as unknown as ProjectCtx;

describe("buildProjectSummaryPrompt", () => {
  it("instructs 3-5 sentences and factual tone", () => {
    const { system } = buildProjectSummaryPrompt(projectCtx);
    expect(system).toMatch(/3-5 short sentences/i);
    expect(system).toMatch(/plain factual tone/i);
  });

  it("surfaces project code, WO number, and client", () => {
    const { prompt } = buildProjectSummaryPrompt(projectCtx);
    expect(prompt).toContain("P-001");
    expect(prompt).toContain("WO-2026-001");
    expect(prompt).toContain("Apollo Hospital");
  });

  it("lists milestones by stage key with percent complete", () => {
    const { prompt } = buildProjectSummaryPrompt(projectCtx);
    expect(prompt).toContain("ROUGH_IN");
    expect(prompt).toContain("TESTING");
    expect(prompt).toContain("40%");
  });

  it("lists recent invoices and open service tickets", () => {
    const { prompt } = buildProjectSummaryPrompt(projectCtx);
    expect(prompt).toContain("INV-0001");
    expect(prompt).toContain("PROGRESS");
    expect(prompt).toContain("T-2026-0001");
    expect(prompt).toContain("Leak at sprinkler");
  });

  it("handles a project with no milestones and no invoices", () => {
    const { prompt } = buildProjectSummaryPrompt({
      ...projectCtx,
      milestones: [],
      clientInvoices: [],
      serviceIssues: [],
    });
    expect(prompt).toContain("(no milestones defined)");
    expect(prompt).toContain("(no invoices yet)");
    expect(prompt).toContain("(no open tickets)");
  });

  it("handles a project with no purchase order", () => {
    const { prompt } = buildProjectSummaryPrompt({
      ...projectCtx,
      purchaseOrder: null,
    });
    expect(prompt).toContain("No Work Order.");
  });
});

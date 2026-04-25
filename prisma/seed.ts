import {
  PrismaClient,
  Role,
  EmploymentType,
  ProjectStatus,
  BudgetCategory,
  ProjectStageKey,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  // Demo data (users, rate cards, materials, clients, the SAB-2026-0001
  // project, sequences) only runs when SEED_DEMO_DATA is explicitly set.
  // Production deploys leave this unset, so even if SEED_DB=true is still
  // wired up in the entrypoint the demo block is a no-op.
  const seedDemo = process.env.SEED_DEMO_DATA === "true";
  if (!seedDemo) {
    console.log(
      "Demo seed skipped (SEED_DEMO_DATA != 'true'). Running stage backfill only.",
    );
  }

  if (seedDemo) {
    const passwordHash = await bcrypt.hash("password123", 10);

  // --- Users ---
  const users = [
    { email: "admin@sab.local", name: "Asha Admin", role: Role.ADMIN, employmentType: null },
    { email: "manager@sab.local", name: "Meera Manager", role: Role.MANAGER, employmentType: null },
    { email: "super@sab.local", name: "Suresh Supervisor", role: Role.SUPERVISOR, employmentType: null },
    { email: "hourly@sab.local", name: "Hari Hourly", role: Role.EMPLOYEE, employmentType: EmploymentType.HOURLY },
    { email: "salaried@sab.local", name: "Sana Salaried", role: Role.EMPLOYEE, employmentType: EmploymentType.SALARIED },
  ] as const;

  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, active: true },
    });
  }

  const hourly = await db.user.findUniqueOrThrow({ where: { email: "hourly@sab.local" } });
  const salaried = await db.user.findUniqueOrThrow({ where: { email: "salaried@sab.local" } });
  const supervisor = await db.user.findUniqueOrThrow({ where: { email: "super@sab.local" } });

  // --- Rate cards ---
  await db.employeeRateCard.upsert({
    where: { id: `seed-hourly-${hourly.id}` },
    update: {},
    create: {
      id: `seed-hourly-${hourly.id}`,
      userId: hourly.id,
      type: EmploymentType.HOURLY,
      hourlyRate: "200",
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    },
  });

  await db.employeeRateCard.upsert({
    where: { id: `seed-salaried-${salaried.id}` },
    update: {},
    create: {
      id: `seed-salaried-${salaried.id}`,
      userId: salaried.id,
      type: EmploymentType.SALARIED,
      monthlySalary: "60000",
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    },
  });

  // --- Materials ---
  await db.material.upsert({
    where: { sku: "CABLE-6SQMM" },
    update: {},
    create: { sku: "CABLE-6SQMM", name: "Copper cable 6 sqmm", unit: "m" },
  });
  await db.material.upsert({
    where: { sku: "RELAY-24V" },
    update: {},
    create: { sku: "RELAY-24V", name: "Relay 24V DC", unit: "pcs" },
  });

  // --- Clients (new) ---
  const apollo = await db.client.upsert({
    where: { name_gstin: { name: "Apollo Hospitals", gstin: "33AAACA1234B1Z5" } },
    update: {},
    create: {
      name: "Apollo Hospitals",
      gstin: "33AAACA1234B1Z5",
      pan: "AAACA1234B",
      billingAddress: "Greams Road, Chennai 600006",
      stateCode: "33",
      contactName: "Dr. Ravi Kumar",
      email: "biomed@apollo.example",
      phone: "+91 44 2829 3333",
    },
  });

  await db.client.upsert({
    where: { name_gstin: { name: "KMC Hospital Manipal", gstin: "29AAACK0000A1Z5" } },
    update: {},
    create: {
      name: "KMC Hospital Manipal",
      gstin: "29AAACK0000A1Z5",
      pan: "AAACK0000A",
      billingAddress: "Madhav Nagar, Manipal 576104",
      stateCode: "29",
      contactName: "Dr. Nandini Rao",
      email: "procurement@kmc.example",
      phone: "+91 820 292 2000",
    },
  });

  // --- Project ---
  await db.project.upsert({
    where: { code: "SAB-2026-0001" },
    update: { clientId: apollo.id },
    create: {
      code: "SAB-2026-0001",
      name: "CT Scanner Install - Apollo Chennai",
      clientName: "Apollo Hospitals",
      clientId: apollo.id,
      status: ProjectStatus.ACTIVE,
      contractValue: "1000000",
      startDate: new Date("2026-02-01T00:00:00Z"),
      siteSupervisorId: supervisor.id,
      budgetLines: {
        create: [
          {
            category: BudgetCategory.MATERIAL,
            description: "Cables, relays, mounting hardware",
            quantity: "1",
            unitCost: "400000",
            total: "400000",
          },
          {
            category: BudgetCategory.LABOR,
            description: "Installation team hours",
            quantity: "1",
            unitCost: "200000",
            total: "200000",
          },
          {
            category: BudgetCategory.OTHER,
            description: "Logistics, permits",
            quantity: "1",
            unitCost: "50000",
            total: "50000",
          },
        ],
      },
    },
  });

    // --- Project code sequence bookkeeping (demo project took #1) ---
    await db.projectCodeSequence.upsert({
      where: { year: 2026 },
      update: {},
      create: { year: 2026, next: 2 },
    });

    // --- Sales pipeline sequences (demo block; the app self-initialises
    //     these via upsert when the first quote/PO/invoice is created) ---
    await db.quoteNumberSequence.upsert({
      where: { year: 2026 },
      update: {},
      create: { year: 2026, next: 1 },
    });
    await db.pONumberSequence.upsert({
      where: { year: 2026 },
      update: {},
      create: { year: 2026, next: 1 },
    });
    await db.clientInvoiceNumberSequence.upsert({
      where: { year: 2026 },
      update: {},
      create: { year: 2026, next: 1 },
    });

    console.log(
      "Demo seed complete. Users: admin@sab.local / manager@sab.local / super@sab.local / hourly@sab.local / salaried@sab.local — password: password123",
    );
  }

  // --- Backfill: seed 5 stage rows for every project without stages ---
  const projectsNeedingStages = await db.project.findMany({
    where: { stages: { none: {} } },
    select: { id: true },
  });
  const STAGE_KEYS: ProjectStageKey[] = [
    "SURVEY",
    "DELIVERY",
    "INSTALL",
    "COMMISSION",
    "HANDOVER",
  ];
  for (const p of projectsNeedingStages) {
    await db.projectStage.createMany({
      data: STAGE_KEYS.map((k) => ({ projectId: p.id, stageKey: k })),
      skipDuplicates: true,
    });
  }

  console.log(`Backfilled stages for ${projectsNeedingStages.length} project(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

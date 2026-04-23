import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const projects = await db.project.findMany({
  select: { code: true, poNumber: true, name: true },
  orderBy: { code: "asc" },
});
for (const p of projects) {
  console.log(`${p.code.padEnd(16)} | ${String(p.poNumber ?? "").padEnd(30)} | ${p.name}`);
}
console.log(`\nTotal: ${projects.length}`);
await db.$disconnect();

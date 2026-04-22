-- Close any orphan "open" time entries (clockOut IS NULL) beyond the most
-- recent one per employee. Keeps the latest as still-running; collapses
-- earlier duplicates into zero-length entries so the partial unique index
-- below can be enforced without data loss.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "employeeId" ORDER BY "clockIn" DESC) AS rn
  FROM "TimeEntry"
  WHERE "clockOut" IS NULL
)
UPDATE "TimeEntry" AS te
SET "clockOut" = te."clockIn",
    "minutes" = 0
FROM ranked
WHERE te.id = ranked.id
  AND ranked.rn > 1;

-- Enforce: an employee can have at most ONE entry with clockOut IS NULL at a
-- time. This is a DB-level guard against concurrent punch-ins/switches
-- creating overlapping time windows.
CREATE UNIQUE INDEX "TimeEntry_employeeId_open_uniq"
ON "TimeEntry" ("employeeId")
WHERE "clockOut" IS NULL;

import { cache } from "react";
import { TimeEntryStatus } from "@prisma/client";
import { db } from "@/server/db";

// React-cached lookup — the layout and page both call this; the cache
// dedupes the query so we hit the DB once per request.
export const getOpenEntry = cache(async (userId: string) => {
  return db.timeEntry.findFirst({
    where: {
      employeeId: userId,
      status: TimeEntryStatus.OPEN,
      clockOut: null,
    },
    include: { project: true },
  });
});

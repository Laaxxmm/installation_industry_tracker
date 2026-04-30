// Pure budget-check math for material indents. Lives outside actions/db so
// it can be unit-tested without spinning up Prisma. The DB query layer in
// `src/server/actions/indents.ts` aggregates the four inputs (budgeted,
// issued, pending, requested) and feeds them in here for the verdict.

import { Decimal } from "decimal.js";
import { toDecimal } from "@/lib/money";

export type BudgetVerdict =
  | { isInBudget: true; remaining: string }
  | { isInBudget: false; reason: string; remaining: string };

export function checkLineBudget(input: {
  budgetedQty: Decimal | string | number;
  alreadyIssuedQty: Decimal | string | number;
  pendingIndentQty: Decimal | string | number;
  requestedQty: Decimal | string | number;
  materialName: string;
}): BudgetVerdict {
  const budgeted = toDecimal(input.budgetedQty);
  const issued = toDecimal(input.alreadyIssuedQty);
  const pending = toDecimal(input.pendingIndentQty);
  const requested = toDecimal(input.requestedQty);

  // No materialId-bound budget at all → out of budget.
  if (budgeted.lte(0)) {
    return {
      isInBudget: false,
      reason: `${input.materialName} is not in the project budget — requires ADMIN approval`,
      remaining: "0",
    };
  }

  const remaining = budgeted.minus(issued).minus(pending);

  if (requested.lte(remaining)) {
    return { isInBudget: true, remaining: remaining.toString() };
  }

  // Format remaining for the message; if it went negative, show 0 to the user
  // (they've already over-committed via prior pending indents).
  const remainingDisplay = remaining.lt(0) ? "0" : remaining.toString();
  return {
    isInBudget: false,
    reason: `Requested ${requested.toString()} of ${input.materialName} exceeds remaining budget of ${remainingDisplay}`,
    remaining: remainingDisplay,
  };
}

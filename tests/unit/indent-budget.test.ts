import { describe, expect, it } from "vitest";
import { checkLineBudget } from "@/lib/indent-budget";

describe("checkLineBudget", () => {
  const baseInput = {
    budgetedQty: 100,
    alreadyIssuedQty: 0,
    pendingIndentQty: 0,
    requestedQty: 50,
    materialName: "8mm Connector",
  };

  it("returns in-budget when requested fits in remaining", () => {
    const v = checkLineBudget(baseInput);
    expect(v.isInBudget).toBe(true);
    if (v.isInBudget) expect(v.remaining).toBe("100");
  });

  it("returns out-of-budget when material has zero budget binding", () => {
    const v = checkLineBudget({ ...baseInput, budgetedQty: 0 });
    expect(v.isInBudget).toBe(false);
    if (!v.isInBudget) {
      expect(v.reason).toContain("not in the project budget");
      expect(v.reason).toContain("8mm Connector");
    }
  });

  it("returns out-of-budget when requested exceeds remaining", () => {
    const v = checkLineBudget({
      ...baseInput,
      budgetedQty: 100,
      alreadyIssuedQty: 80,
      requestedQty: 25, // remaining = 20, requested 25 → over
    });
    expect(v.isInBudget).toBe(false);
    if (!v.isInBudget) {
      expect(v.reason).toContain("exceeds remaining budget of 20");
      expect(v.reason).toContain("8mm Connector");
    }
  });

  it("subtracts pending-indent commitments from remaining", () => {
    const v = checkLineBudget({
      ...baseInput,
      budgetedQty: 100,
      alreadyIssuedQty: 30,
      pendingIndentQty: 50, // 100 − 30 − 50 = 20 remaining
      requestedQty: 30, // exceeds 20
    });
    expect(v.isInBudget).toBe(false);
    if (!v.isInBudget) {
      expect(v.reason).toContain("remaining budget of 20");
    }
  });

  it("treats requested == remaining as in-budget (boundary)", () => {
    const v = checkLineBudget({
      ...baseInput,
      budgetedQty: 100,
      alreadyIssuedQty: 50,
      pendingIndentQty: 30,
      requestedQty: 20, // exactly 20 remaining
    });
    expect(v.isInBudget).toBe(true);
    if (v.isInBudget) expect(v.remaining).toBe("20");
  });

  it("clamps remaining to 0 when prior commitments already overshot budget", () => {
    const v = checkLineBudget({
      ...baseInput,
      budgetedQty: 100,
      alreadyIssuedQty: 80,
      pendingIndentQty: 30, // 100 − 80 − 30 = -10
      requestedQty: 1,
    });
    expect(v.isInBudget).toBe(false);
    if (!v.isInBudget) {
      expect(v.reason).toContain("remaining budget of 0");
    }
  });

  it("handles decimal quantities precisely (not float math)", () => {
    const v = checkLineBudget({
      ...baseInput,
      budgetedQty: "10.5",
      alreadyIssuedQty: "3.25",
      pendingIndentQty: "2.125",
      requestedQty: "5.125", // remaining = 5.125 exactly
    });
    expect(v.isInBudget).toBe(true);
    if (v.isInBudget) expect(v.remaining).toBe("5.125");
  });

  it("handles a tiny over-budget by a fractional amount", () => {
    const v = checkLineBudget({
      budgetedQty: 10,
      alreadyIssuedQty: 5,
      pendingIndentQty: 0,
      requestedQty: "5.001",
      materialName: "Pipe",
    });
    expect(v.isInBudget).toBe(false);
  });

  it("includes the material name in the out-of-budget reason", () => {
    const v = checkLineBudget({
      ...baseInput,
      budgetedQty: 0,
      materialName: "Pump 1.5HP",
    });
    expect(v.isInBudget).toBe(false);
    if (!v.isInBudget) expect(v.reason).toContain("Pump 1.5HP");
  });

  it("includes requested qty in the over-budget reason", () => {
    const v = checkLineBudget({
      ...baseInput,
      budgetedQty: 100,
      alreadyIssuedQty: 95,
      requestedQty: 10,
    });
    expect(v.isInBudget).toBe(false);
    if (!v.isInBudget) {
      expect(v.reason).toContain("Requested 10");
      expect(v.reason).toContain("remaining budget of 5");
    }
  });
});

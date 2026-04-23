import { describe, it, expect } from "vitest";
import { computeLine, summarise } from "@/lib/gst";

describe("computeLine", () => {
  it("applies discount then tax (intra-state case rows use same amounts)", () => {
    const r = computeLine({ quantity: 2, unitPrice: 1000, discountPct: 10, gstRatePct: 18 });
    expect(r.subtotal.toFixed(2)).toBe("1800.00");
    expect(r.tax.toFixed(2)).toBe("324.00");
    expect(r.total.toFixed(2)).toBe("2124.00");
  });

  it("zero-rated line produces no tax", () => {
    const r = computeLine({ quantity: 5, unitPrice: 200, discountPct: 0, gstRatePct: 0 });
    expect(r.subtotal.toFixed(2)).toBe("1000.00");
    expect(r.tax.toFixed(2)).toBe("0.00");
    expect(r.total.toFixed(2)).toBe("1000.00");
  });

  it("rounds to 2dp at line boundary", () => {
    const r = computeLine({ quantity: 3, unitPrice: "100.01", discountPct: "7.5", gstRatePct: 18 });
    // 3 * 100.01 = 300.03; * (1 - 0.075) = 300.03 * 0.925 = 277.52775 → 277.53
    expect(r.subtotal.toFixed(2)).toBe("277.53");
    // 277.53 * 0.18 = 49.9554 → 49.96
    expect(r.tax.toFixed(2)).toBe("49.96");
    expect(r.total.toFixed(2)).toBe("327.49");
  });
});

describe("summarise", () => {
  it("intra-state: splits CGST/SGST, zero IGST", () => {
    const r = summarise({
      lines: [{ quantity: 2, unitPrice: 1000, discountPct: 10, gstRatePct: 18 }],
      supplierStateCode: "29",
      placeOfSupplyStateCode: "29",
    });
    expect(r.subtotal.toFixed(2)).toBe("1800.00");
    expect(r.cgst.toFixed(2)).toBe("162.00");
    expect(r.sgst.toFixed(2)).toBe("162.00");
    expect(r.igst.toFixed(2)).toBe("0.00");
    expect(r.taxTotal.toFixed(2)).toBe("324.00");
    expect(r.grandTotal.toFixed(2)).toBe("2124.00");
    expect(r.gstBreakdown).toHaveLength(1);
    expect(r.gstBreakdown[0]!.ratePct).toBe("18");
  });

  it("inter-state: IGST carries full tax, CGST/SGST = 0", () => {
    const r = summarise({
      lines: [{ quantity: 2, unitPrice: 1000, discountPct: 10, gstRatePct: 18 }],
      supplierStateCode: "29",
      placeOfSupplyStateCode: "33",
    });
    expect(r.cgst.toFixed(2)).toBe("0.00");
    expect(r.sgst.toFixed(2)).toBe("0.00");
    expect(r.igst.toFixed(2)).toBe("324.00");
    expect(r.grandTotal.toFixed(2)).toBe("2124.00");
  });

  it("groups breakdown by rate when mixed", () => {
    const r = summarise({
      lines: [
        { quantity: 10, unitPrice: 100, discountPct: 0, gstRatePct: 5 }, // 1000 +50
        { quantity: 1, unitPrice: 2000, discountPct: 0, gstRatePct: 18 }, // 2000 +360
      ],
      supplierStateCode: "29",
      placeOfSupplyStateCode: "29",
    });
    expect(r.subtotal.toFixed(2)).toBe("3000.00");
    expect(r.taxTotal.toFixed(2)).toBe("410.00");
    expect(r.grandTotal.toFixed(2)).toBe("3410.00");
    expect(r.gstBreakdown.map((b) => b.ratePct)).toEqual(["5", "18"]);
    expect(r.gstBreakdown[0]!.taxable.toFixed(2)).toBe("1000.00");
    expect(r.gstBreakdown[1]!.taxable.toFixed(2)).toBe("2000.00");
  });

  it("grand total equals sum of line totals (no rounding drift)", () => {
    const lines = [
      { quantity: 3, unitPrice: "100.01", discountPct: "7.5", gstRatePct: 18 },
      { quantity: 1, unitPrice: "333.33", discountPct: 0, gstRatePct: 12 },
    ];
    const r = summarise({
      lines,
      supplierStateCode: "29",
      placeOfSupplyStateCode: "29",
    });
    const expectedGrand = lines
      .map((l) => computeLine(l).total)
      .reduce((a, b) => a.plus(b), computeLine(lines[0]!).total.minus(computeLine(lines[0]!).total));
    // Simpler: grand should equal sum of individual totals
    const sumOfLineTotals = lines.reduce((a, l) => a.plus(computeLine(l).total), expectedGrand.minus(expectedGrand));
    expect(r.grandTotal.toFixed(2)).toBe(sumOfLineTotals.toFixed(2));
  });
});

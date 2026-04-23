import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import { newMovingAverage, issueCost } from "@/lib/inventory-cost";

describe("newMovingAverage", () => {
  it("first receipt into empty stock takes the receipt unit cost", () => {
    const r = newMovingAverage({
      onHandQty: 0,
      avgUnitCost: 0,
      receiptQty: 100,
      receiptUnitCost: 120,
    });
    expect(r.qty.toString()).toBe("100");
    expect(r.avgUnitCost.toString()).toBe("120");
  });

  it("blends prior value with new receipt value", () => {
    // 100 @ ₹120 (value 12,000) + 50 @ ₹150 (value 7,500) = 150 @ (19500/150)=130
    const r = newMovingAverage({
      onHandQty: 100,
      avgUnitCost: 120,
      receiptQty: 50,
      receiptUnitCost: 150,
    });
    expect(r.qty.toString()).toBe("150");
    expect(r.avgUnitCost.toString()).toBe("130");
  });

  it("multiple sequential receipts compound the average", () => {
    // start empty → receive 100 @ ₹120 → avg=120
    // receive 50 @ ₹150 → avg=130
    // receive 25 @ ₹200 → (150*130 + 25*200) / 175 = (19500+5000)/175 = 140
    let state = { qty: new Decimal(0), avgUnitCost: new Decimal(0) };
    state = newMovingAverage({
      onHandQty: state.qty,
      avgUnitCost: state.avgUnitCost,
      receiptQty: 100,
      receiptUnitCost: 120,
    });
    state = newMovingAverage({
      onHandQty: state.qty,
      avgUnitCost: state.avgUnitCost,
      receiptQty: 50,
      receiptUnitCost: 150,
    });
    state = newMovingAverage({
      onHandQty: state.qty,
      avgUnitCost: state.avgUnitCost,
      receiptQty: 25,
      receiptUnitCost: 200,
    });
    expect(state.qty.toString()).toBe("175");
    expect(state.avgUnitCost.toString()).toBe("140");
  });

  it("rejects non-positive receipt qty", () => {
    expect(() =>
      newMovingAverage({ onHandQty: 10, avgUnitCost: 5, receiptQty: 0, receiptUnitCost: 1 }),
    ).toThrow();
    expect(() =>
      newMovingAverage({ onHandQty: 10, avgUnitCost: 5, receiptQty: -1, receiptUnitCost: 1 }),
    ).toThrow();
  });

  it("preserves precision on fractional averages", () => {
    // 3 @ ₹10 + 2 @ ₹13 → (30+26)/5 = 11.2
    const r = newMovingAverage({
      onHandQty: 3,
      avgUnitCost: 10,
      receiptQty: 2,
      receiptUnitCost: 13,
    });
    expect(r.avgUnitCost.toString()).toBe("11.2");
  });
});

describe("issueCost", () => {
  it("multiplies qty by snapshot unit cost", () => {
    expect(issueCost(40, 120).toString()).toBe("4800");
  });
  it("handles Decimal inputs", () => {
    expect(
      issueCost(new Decimal("12.5"), new Decimal("8.4")).toString(),
    ).toBe("105");
  });
});

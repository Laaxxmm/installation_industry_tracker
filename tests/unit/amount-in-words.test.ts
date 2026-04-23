import { describe, it, expect } from "vitest";
import { amountInWords } from "@/lib/amount-in-words";

describe("amountInWords (Indian numbering)", () => {
  it("round rupees, no paise", () => {
    expect(amountInWords(119100)).toBe("Rupees One Lakh Nineteen Thousand One Hundred Only");
  });

  it("paise only", () => {
    expect(amountInWords("2.50")).toBe("Rupees Two and Fifty Paise Only");
  });

  it("zero rupees, paise only", () => {
    expect(amountInWords("0.75")).toBe("Rupees Zero and Seventy Five Paise Only");
  });

  it("zero amount", () => {
    expect(amountInWords(0)).toBe("Rupees Zero Only");
  });

  it("crore boundary", () => {
    expect(amountInWords(12_345_678)).toBe(
      "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only",
    );
  });

  it("lakh boundary", () => {
    expect(amountInWords(100000)).toBe("Rupees One Lakh Only");
  });

  it("rupees and paise combined", () => {
    expect(amountInWords("36580.50")).toBe(
      "Rupees Thirty Six Thousand Five Hundred Eighty and Fifty Paise Only",
    );
  });

  it("teens handled in paise", () => {
    expect(amountInWords("1.19")).toBe("Rupees One and Nineteen Paise Only");
  });

  it("rounds half-up on the third decimal", () => {
    // 100.005 → 100.01 → paise = 1
    expect(amountInWords("100.005")).toBe("Rupees One Hundred and One Paise Only");
  });
});

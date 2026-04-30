import { describe, expect, it } from "vitest";
import { detectImageKind, extForImageKind } from "@/lib/file-magic";

// Build minimum-viable byte sequences for each format. We only care about
// the magic-byte prefix; the rest can be zero-padded.
function withTail(prefix: number[], len = 32): Buffer {
  const buf = Buffer.alloc(len);
  prefix.forEach((b, i) => (buf[i] = b));
  return buf;
}

describe("detectImageKind", () => {
  it("detects JPEG (FF D8 FF)", () => {
    expect(detectImageKind(withTail([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
  });

  it("detects PNG (89 50 4E 47 0D 0A 1A 0A)", () => {
    expect(
      detectImageKind(
        withTail([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("png");
  });

  it("detects GIF87a", () => {
    expect(
      detectImageKind(withTail([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])),
    ).toBe("gif");
  });

  it("detects GIF89a", () => {
    expect(
      detectImageKind(withTail([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])),
    ).toBe("gif");
  });

  it("detects WebP (RIFF...WEBP)", () => {
    expect(
      detectImageKind(
        withTail([
          0x52, 0x49, 0x46, 0x46, // RIFF
          0x00, 0x00, 0x00, 0x00, // size placeholder
          0x57, 0x45, 0x42, 0x50, // WEBP
        ]),
      ),
    ).toBe("webp");
  });

  it("detects HEIC (ftyp + heic brand)", () => {
    expect(
      detectImageKind(
        withTail([
          0x00, 0x00, 0x00, 0x18, // box size
          0x66, 0x74, 0x79, 0x70, // ftyp
          0x68, 0x65, 0x69, 0x63, // heic
        ]),
      ),
    ).toBe("heic");
  });

  it("detects HEIF (ftyp + mif1 brand)", () => {
    expect(
      detectImageKind(
        withTail([
          0x00, 0x00, 0x00, 0x18,
          0x66, 0x74, 0x79, 0x70,
          0x6d, 0x69, 0x66, 0x31, // mif1
        ]),
      ),
    ).toBe("heic");
  });

  it("rejects PDF (%PDF-)", () => {
    expect(
      detectImageKind(withTail([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e])),
    ).toBe(null);
  });

  it("rejects HTML (<!DOCTYPE)", () => {
    expect(
      detectImageKind(
        withTail([0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45]),
      ),
    ).toBe(null);
  });

  it("rejects ZIP (PK..)", () => {
    expect(detectImageKind(withTail([0x50, 0x4b, 0x03, 0x04]))).toBe(null);
  });

  it("rejects ELF (executable)", () => {
    expect(detectImageKind(withTail([0x7f, 0x45, 0x4c, 0x46]))).toBe(null);
  });

  it("rejects buffers shorter than 12 bytes", () => {
    expect(detectImageKind(Buffer.from([0xff, 0xd8, 0xff]))).toBe(null);
  });

  it("rejects fake-jpeg-extension on a script payload", () => {
    // Looks like ASCII text — common for crafted exploit attempts.
    const payload = Buffer.from("#!/bin/bash\nrm -rf /\n", "utf8");
    expect(detectImageKind(payload)).toBe(null);
  });
});

describe("extForImageKind", () => {
  it("normalizes jpeg → jpg", () => {
    expect(extForImageKind("jpeg")).toBe("jpg");
  });
  it("returns identity for other kinds", () => {
    expect(extForImageKind("png")).toBe("png");
    expect(extForImageKind("webp")).toBe("webp");
    expect(extForImageKind("gif")).toBe("gif");
    expect(extForImageKind("heic")).toBe("heic");
  });
});

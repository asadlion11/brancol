import { describe, expect, it } from "vitest";

import {
  completeColor,
  describeColor,
  formatHslString,
  formatOklchString,
  formatRgbString,
  hexFromOklch,
  normalizeHex,
  sanitizeName,
} from "../color";
import { AA_NORMAL, bestForeground, contrastRatio, meetsAA } from "../contrast";

describe("normalizeHex", () => {
  it("uppercases and keeps a valid 6-digit hex", () => {
    expect(normalizeHex("#1769aa")).toBe("#1769AA");
  });

  it("expands 3-digit shorthand", () => {
    expect(normalizeHex("#f0a")).toBe("#FF00AA");
  });

  it("adds a missing #", () => {
    expect(normalizeHex("1769AA")).toBe("#1769AA");
  });

  it("drops the alpha channel from 8-digit hex", () => {
    expect(normalizeHex("#1769AACC")).toBe("#1769AA");
  });

  it("strips stray quotes, semicolons and whitespace", () => {
    expect(normalizeHex('  "#1769AA";  ')).toBe("#1769AA");
  });

  it("recovers a color the model expressed as CSS", () => {
    expect(normalizeHex("rgb(23,105,170)")).toBe("#1769AA");
    expect(normalizeHex("steelblue")).toBe("#4682B4");
  });

  it("rejects anything that is not a color", () => {
    expect(normalizeHex("not a color")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
    expect(normalizeHex(42)).toBeNull();
  });
});

describe("format strings", () => {
  it("matches the pinned rgb() format", () => {
    expect(formatRgbString("#1769AA")).toBe("rgb(23,105,170)");
  });

  it("matches the pinned hsl() format", () => {
    expect(formatHslString("#1769AA")).toMatch(
      /^hsl\(\d{1,3},\d{1,3}%,\d{1,3}%\)$/,
    );
    expect(formatHslString("#FFFFFF")).toBe("hsl(0,0%,100%)");
  });

  it("matches the pinned oklch() format", () => {
    expect(formatOklchString("#1769AA")).toMatch(
      /^oklch\(\d\.\d{2} \d\.\d{2} \d{1,3}\)$/,
    );
  });

  it("gives achromatic colors hue 0 instead of NaN", () => {
    expect(formatHslString("#808080")).toBe("hsl(0,0%,50%)");
    expect(formatOklchString("#000000")).toBe("oklch(0.00 0.00 0)");
  });
});

describe("completeColor", () => {
  it("derives every format from the hex", () => {
    expect(completeColor("#1769aa")).toEqual({
      hex: "#1769AA",
      rgb: "rgb(23,105,170)",
      hsl: formatHslString("#1769AA"),
      oklch: formatOklchString("#1769AA"),
    });
  });

  it("completes a 3-digit hex the model shortened", () => {
    expect(completeColor("#0af").hex).toBe("#00AAFF");
  });

  it("throws on input that is not a color, so callers must filter first", () => {
    expect(() => completeColor("banana split")).toThrow();
  });
});

describe("hexFromOklch", () => {
  it("round-trips through the oklch formatter", () => {
    const hex = hexFromOklch(0.5, 0.12, 250);
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("naming", () => {
  it("keeps an evocative model name", () => {
    expect(sanitizeName("Ocean Blue", "#1769AA")).toBe("Ocean Blue");
  });

  it("rejects generic and systematic names", () => {
    for (const generic of [
      "Color 01",
      "Blue 500",
      "gray-900",
      "Primary",
      "#1769AA",
      "swatch 3",
    ]) {
      const name = sanitizeName(generic, "#1769AA");
      expect(name).not.toBe(generic);
      expect(name).toBe(describeColor("#1769AA"));
    }
  });

  it("falls back to a descriptive name when the model omits one", () => {
    expect(sanitizeName(undefined, "#1769AA")).toBe(describeColor("#1769AA"));
    expect(describeColor("#1769AA")).not.toMatch(/\d/);
  });

  it("title-cases a shouted or lower-cased name", () => {
    expect(sanitizeName("warm clay", "#B8674A")).toBe("Warm Clay");
    expect(sanitizeName("WARM CLAY", "#B8674A")).toBe("Warm Clay");
  });

  it("names neutrals without a hue word", () => {
    expect(describeColor("#FFFFFF")).toBe("Paper White");
    expect(describeColor("#111111")).toBe("Deep Charcoal");
  });
});

describe("contrast", () => {
  it("computes known WCAG ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("applies the AA thresholds", () => {
    expect(meetsAA("#111111", "#FFFFFF")).toBe(true);
    expect(meetsAA("#777777", "#808080")).toBe(false);
    expect(meetsAA("#767676", "#FFFFFF", true)).toBe(true);
  });

  it("picks white ink on a dark background and dark ink on a light one", () => {
    expect(bestForeground("#0B1A2B").hex).toBe("#FFFFFF");
    expect(bestForeground("#F2F7F5").hex).toBe("#111111");
  });

  it("reports the winning ratio and whether it clears AA", () => {
    const choice = bestForeground("#1769AA");
    expect(choice.ratio).toBeGreaterThan(1);
    expect(choice.passesAA).toBe(choice.ratio >= AA_NORMAL);
  });
});

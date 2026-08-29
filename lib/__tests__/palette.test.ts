import { describe, expect, it } from "vitest";

import { coerceRole, normalizePalette, targetRoles } from "../palette";
import type { AIColor } from "../schemas";
import { ROLES } from "../types";

const FIVE: AIColor[] = [
  { role: "primary", name: "Ocean Blue", hex: "#1769AA" },
  { role: "secondary", name: "Sea Foam", hex: "#7FB8A4" },
  { role: "background", name: "Paper Mist", hex: "#F6F8F7" },
  { role: "text", name: "Deep Pine", hex: "#16241F" },
  { role: "accent", name: "Warm Clay", hex: "#C97B5A" },
];

describe("coerceRole", () => {
  it("passes through valid roles", () => {
    for (const role of ROLES) expect(coerceRole(role)).toBe(role);
  });

  it("normalizes case, spacing and the word 'color'", () => {
    expect(coerceRole("  Primary ")).toBe("primary");
    expect(coerceRole("Background Color")).toBe("background");
    expect(coerceRole("accent-color")).toBe("accent");
  });

  it("maps common synonyms onto the union", () => {
    expect(coerceRole("brand")).toBe("primary");
    expect(coerceRole("bg")).toBe("background");
    expect(coerceRole("foreground")).toBe("text");
    expect(coerceRole("danger")).toBe("error");
    expect(coerceRole("card")).toBe("surface");
    expect(coerceRole("neutral")).toBe("muted");
  });

  it("matches on a leading known word", () => {
    expect(coerceRole("primary blue")).toBe("primary");
  });

  it("returns null for genuinely unknown roles", () => {
    expect(coerceRole("sparkle")).toBeNull();
    expect(coerceRole(undefined)).toBeNull();
    expect(coerceRole(7)).toBeNull();
  });
});

describe("targetRoles", () => {
  it("scales the mix with the count", () => {
    // A two-colour system is primary + secondary: the two roles a user with
    // no existing palette actually needs named first.
    expect(targetRoles(2)).toEqual(["primary", "secondary"]);
    expect(targetRoles(5)).toHaveLength(5);
    expect(targetRoles(10)).toHaveLength(10);
  });

  it("always leads with primary, then secondary", () => {
    for (let count = 2; count <= 10; count += 1) {
      expect(targetRoles(count)[0]).toBe("primary");
      expect(targetRoles(count)[1]).toBe("secondary");
    }
  });
});

describe("normalizePalette", () => {
  it("returns exactly the requested count", () => {
    expect(normalizePalette(FIVE, { count: 5 })).toHaveLength(5);
  });

  it("truncates when the model returns too many colors", () => {
    const tooMany: AIColor[] = [
      ...FIVE,
      { hex: "#123456" },
      { hex: "#654321" },
    ];
    expect(normalizePalette(tooMany, { count: 5 })).toHaveLength(5);
  });

  it("pads when the model returns too few colors", () => {
    const palette = normalizePalette(
      [{ role: "primary", name: "Ocean Blue", hex: "#1769AA" }],
      {
        count: 6,
      },
    );
    expect(palette).toHaveLength(6);
    for (const color of palette) {
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(color.name.length).toBeGreaterThan(2);
    }
  });

  it("works at both ends of the range", () => {
    expect(normalizePalette(FIVE, { count: 2 })).toHaveLength(2);
    expect(normalizePalette(FIVE, { count: 10 })).toHaveLength(10);
  });

  it("guarantees exactly one primary even when the model never names one", () => {
    const noPrimary: AIColor[] = FIVE.map((color) => ({
      ...color,
      role: "sparkle",
    }));
    const palette = normalizePalette(noPrimary, { count: 5 });
    expect(palette.filter((color) => color.role === "primary")).toHaveLength(1);
  });

  it("assigns a role to colors that arrive without one", () => {
    const palette = normalizePalette(
      [{ hex: "#1769AA" }, { hex: "#F6F8F7" }, { hex: "#16241F" }],
      {
        count: 3,
      },
    );
    for (const color of palette) expect(ROLES).toContain(color.role);
  });

  it("de-duplicates roles the model repeated", () => {
    const repeated: AIColor[] = FIVE.map((color) => ({
      ...color,
      role: "primary",
    }));
    const palette = normalizePalette(repeated, { count: 5 });
    expect(new Set(palette.map((color) => color.role)).size).toBe(5);
  });

  it("de-duplicates identical hexes", () => {
    const dupes: AIColor[] = [
      { role: "primary", hex: "#1769AA" },
      { role: "accent", hex: "#1769aa" },
      { role: "background", hex: "#F6F8F7" },
    ];
    const palette = normalizePalette(dupes, { count: 3 });
    expect(new Set(palette.map((color) => color.hex)).size).toBe(3);
  });

  it("completes every color with the contract's formats", () => {
    for (const color of normalizePalette(FIVE, { count: 5 })) {
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(color.rgb).toMatch(/^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/);
      expect(color.hsl).toMatch(/^hsl\(\d{1,3},\d{1,3}%,\d{1,3}%\)$/);
      expect(color.oklch).toMatch(/^oklch\(\d\.\d{2} \d\.\d{2} \d{1,3}\)$/);
      expect(color.locked).toBe(false);
    }
  });

  it("never emits a generic name", () => {
    const generic: AIColor[] = FIVE.map((color, index) => ({
      ...color,
      name: `Color 0${index}`,
    }));
    for (const color of normalizePalette(generic, { count: 5 })) {
      expect(color.name).not.toMatch(/^Color/);
      expect(color.name).not.toMatch(/\d/);
    }
  });

  it("gives every color a distinct name", () => {
    const same: AIColor[] = FIVE.map((color) => ({
      ...color,
      name: "Ocean Blue",
    }));
    const names = normalizePalette(same, { count: 5 }).map((color) =>
      color.name.toLowerCase(),
    );
    expect(new Set(names).size).toBe(5);
  });

  it("re-injects locked colors byte-for-byte even when the model ignores them", () => {
    const palette = normalizePalette(FIVE, {
      count: 5,
      locked: [{ hex: "#8B2E5F", name: "Plum Velvet", role: "accent" }],
    });

    const locked = palette.find((color) => color.locked);
    expect(locked).toBeDefined();
    expect(locked?.hex).toBe("#8B2E5F");
    expect(locked?.name).toBe("Plum Velvet");
    expect(locked?.role).toBe("accent");
    expect(palette).toHaveLength(5);
    expect(palette.filter((color) => color.locked)).toHaveLength(1);
  });

  it("keeps a locked color that the model returned in a different shade", () => {
    const drifted: AIColor[] = [
      { role: "primary", name: "Almost", hex: "#8B2E60" },
      ...FIVE,
    ];
    const palette = normalizePalette(drifted, {
      count: 4,
      locked: [{ hex: "#8B2E5F" }],
    });
    expect(palette.map((color) => color.hex)).toContain("#8B2E5F");
  });

  it("orders the palette by the canonical role order", () => {
    const palette = normalizePalette(FIVE, { count: 5 });
    const indexes = palette.map((color) => ROLES.indexOf(color.role));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });
});

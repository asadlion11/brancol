/**
 * Light/dark derivation tests.
 *
 * The failure this suite exists to catch is the plausible one: an
 * implementation that "works" because every color changed, while the hues
 * quietly rotated and the palette arrived in dark mode as somebody else's
 * brand. So the assertions are about *what* changed — hue held, lightness
 * remapped, positional roles crossing the midpoint and identity roles not.
 */

import { describe, expect, it } from "vitest";

import { completeColor, oklchOf } from "../color";
import { deriveVariant, variantHex, variantPair } from "../variants";
import { ROLES, type Color } from "../types";
import { SAMPLE_PALETTE, TEN_COLOR_PALETTE, swatch } from "./fixtures";

/** Shortest angular distance between two hues, in degrees. */
function hueDelta(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function byRole(palette: Color[], role: string): Color {
  return palette.find((color) => color.role === role)!;
}

const dark = deriveVariant(SAMPLE_PALETTE, "dark");

describe("dark derivation", () => {
  it("changes every color", () => {
    for (const [index, color] of dark.entries()) {
      expect(color.hex).not.toBe(SAMPLE_PALETTE[index].hex);
    }
  });

  it("keeps role, name and lock state — it is the same token set", () => {
    expect(dark.map((color) => color.role)).toEqual(
      SAMPLE_PALETTE.map((color) => color.role),
    );
    expect(dark.map((color) => color.name)).toEqual(
      SAMPLE_PALETTE.map((color) => color.name),
    );
    expect(dark.map((color) => color.locked)).toEqual(
      SAMPLE_PALETTE.map((color) => color.locked),
    );
  });

  it("recomputes all four formats from the new hex", () => {
    // The strings must describe the hex they sit next to, not the one they
    // were derived from — hex is the source of truth (L14).
    for (const color of dark) {
      expect({
        hex: color.hex,
        rgb: color.rgb,
        hsl: color.hsl,
        oklch: color.oklch,
      }).toEqual(completeColor(color.hex));
    }
  });

  it("preserves hue", () => {
    for (const [index, color] of dark.entries()) {
      const source = oklchOf(SAMPLE_PALETTE[index].hex);
      const derived = oklchOf(color.hex);

      // Near-achromatic colors have no meaningful hue to preserve; anything
      // with real chroma must come back on the same spoke.
      if (source.c < 0.02 || derived.c < 0.02) continue;
      expect(hueDelta(source.h, derived.h)).toBeLessThan(4);
    }
  });

  it("is not a naive RGB invert", () => {
    // `#FFFFFF - color` rotates hue by roughly 180°. If the implementation
    // ever regressed to that, the hue assertion above would fail — this states
    // the distance explicitly so the failure reads as "you inverted it".
    const source = oklchOf("#7FA88E");
    const inverted = oklchOf("#805771"); // 0xFFFFFF - 0x7FA88E
    expect(hueDelta(source.h, inverted.h)).toBeGreaterThan(90);

    const derived = oklchOf(variantHex("#7FA88E", "primary", "dark"));
    expect(hueDelta(source.h, derived.h)).toBeLessThan(4);
  });
});

describe("positional roles swap ends", () => {
  it("takes a near-white background to a near-black one", () => {
    const light = oklchOf(byRole(SAMPLE_PALETTE, "background").hex);
    const derived = oklchOf(byRole(dark, "background").hex);

    expect(light.l).toBeGreaterThan(0.8);
    expect(derived.l).toBeLessThan(0.3);
  });

  it("takes near-black text to near-white text", () => {
    const light = oklchOf(byRole(SAMPLE_PALETTE, "text").hex);
    const derived = oklchOf(byRole(dark, "text").hex);

    expect(light.l).toBeLessThan(0.5);
    expect(derived.l).toBeGreaterThan(0.85);
  });

  it("keeps background and text on opposite sides in both modes", () => {
    const lightGap =
      oklchOf(byRole(SAMPLE_PALETTE, "background").hex).l -
      oklchOf(byRole(SAMPLE_PALETTE, "text").hex).l;
    const darkGap =
      oklchOf(byRole(dark, "background").hex).l -
      oklchOf(byRole(dark, "text").hex).l;

    expect(lightGap).toBeGreaterThan(0);
    expect(darkGap).toBeLessThan(0);
  });

  it("orders the full ground stack: background under surface under border", () => {
    const derived = deriveVariant(TEN_COLOR_PALETTE, "dark");
    const l = (role: string) => oklchOf(byRole(derived, role).hex).l;

    expect(l("background")).toBeLessThan(l("surface"));
    expect(l("surface")).toBeLessThan(l("border"));
    expect(l("border")).toBeLessThan(l("text"));
  });
});

describe("identity roles stay themselves", () => {
  it("moves the accent less than it moves the background", () => {
    const accentShift = Math.abs(
      oklchOf(byRole(dark, "accent").hex).l -
        oklchOf(byRole(SAMPLE_PALETTE, "accent").hex).l,
    );
    const backgroundShift = Math.abs(
      oklchOf(byRole(dark, "background").hex).l -
        oklchOf(byRole(SAMPLE_PALETTE, "background").hex).l,
    );

    expect(accentShift).toBeLessThan(backgroundShift);
    expect(accentShift).toBeLessThan(0.2);
  });

  it("never mirrors an identity role across the midpoint", () => {
    const identity = [
      "primary",
      "secondary",
      "tertiary",
      "accent",
      "highlight",
    ] as const;
    const derived = deriveVariant(TEN_COLOR_PALETTE, "dark");

    for (const role of identity) {
      const before = oklchOf(byRole(TEN_COLOR_PALETTE, role).hex).l;
      const after = oklchOf(byRole(derived, role).hex).l;
      // A mirror would land at roughly 1 − l. Nothing here goes near that.
      expect(Math.abs(after - (1 - before))).toBeGreaterThan(0.05);
    }
  });
});

describe("light derivation", () => {
  it("brings a dark palette back to a light ground", () => {
    const backToLight = deriveVariant(dark, "light");

    expect(oklchOf(byRole(backToLight, "background").hex).l).toBeGreaterThan(
      0.9,
    );
    expect(oklchOf(byRole(backToLight, "text").hex).l).toBeLessThan(0.4);
  });

  it("holds hue through both directions", () => {
    const source = oklchOf("#D9A59A");
    const inDark = oklchOf(variantHex("#D9A59A", "accent", "dark"));
    const inLight = oklchOf(variantHex("#D9A59A", "accent", "light"));

    expect(hueDelta(source.h, inDark.h)).toBeLessThan(4);
    expect(hueDelta(source.h, inLight.h)).toBeLessThan(4);
  });
});

describe("coverage", () => {
  it("has a rule for every role in ROLES", () => {
    const everyRole = ROLES.map((role) =>
      swatch(role, "#7FA88E", `The ${role}`),
    );
    const derived = deriveVariant(everyRole, "dark");

    expect(derived).toHaveLength(ROLES.length);
    for (const color of derived) {
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
    }

    // Ground and identity roles must not all collapse onto one value.
    expect(new Set(derived.map((color) => color.hex)).size).toBeGreaterThan(5);
  });

  it("variantPair passes the source through as the light half", () => {
    const pair = variantPair(SAMPLE_PALETTE);
    expect(pair.light).toBe(SAMPLE_PALETTE);
    expect(pair.dark).toEqual(dark);
  });
});

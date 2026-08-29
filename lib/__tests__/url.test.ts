/**
 * Share-link tests.
 *
 * Two obligations. A link must reproduce the palette *exactly* — roles, human
 * names and lock state included, not just the hexes — and a link that has been
 * truncated by a chat client, mangled by an email wrapper or edited by hand
 * must never take the app down.
 */

import { describe, expect, it } from "vitest";

import { completeColor, describeColor } from "../color";
import {
  decodePalette,
  decodePaletteFromSearch,
  encodePalette,
  paletteShareUrl,
  PALETTE_PARAM,
} from "../url";
import { ROLES, type Color } from "../types";
import { SAMPLE_PALETTE, TEN_COLOR_PALETTE, swatch } from "./fixtures";

const TWO_COLOR_PALETTE: Color[] = [
  swatch("primary", "#7FA88E", "Meadow Sage"),
  swatch("text", "#3A4A42", "Deep Forest", true),
];

describe("palette ↔ URL round trip", () => {
  it("is exact at count = 2", () => {
    expect(decodePalette(encodePalette(TWO_COLOR_PALETTE))).toEqual(
      TWO_COLOR_PALETTE,
    );
  });

  it("is exact at count = 10", () => {
    expect(decodePalette(encodePalette(TEN_COLOR_PALETTE))).toEqual(
      TEN_COLOR_PALETTE,
    );
  });

  it("carries roles, names and locks — not only hexes", () => {
    const decoded = decodePalette(encodePalette(TEN_COLOR_PALETTE))!;

    expect(decoded.map((color) => color.role)).toEqual(
      TEN_COLOR_PALETTE.map((color) => color.role),
    );
    expect(decoded.map((color) => color.name)).toEqual(
      TEN_COLOR_PALETTE.map((color) => color.name),
    );
    expect(decoded.map((color) => color.locked)).toEqual(
      TEN_COLOR_PALETTE.map((color) => color.locked),
    );
  });

  it("survives every role, both lock states", () => {
    const everyRole = ROLES.slice(0, 10).map((role, index) =>
      swatch(role, "#1769AA", `Role ${role}`, index % 2 === 0),
    );
    expect(decodePalette(encodePalette(everyRole))).toEqual(everyRole);
  });

  it("survives a name full of characters that would break a separator scheme", () => {
    const awkward: Color[] = [
      swatch("primary", "#7FA88E", "Sage — 50% / 50~50"),
      swatch("text", "#3A4A42", "Deep + Forest & Co."),
    ];
    expect(decodePalette(encodePalette(awkward))).toEqual(awkward);
  });

  it("regenerates a derivable name instead of shipping it", () => {
    const derived = describeColor("#7FA88E");
    const palette: Color[] = [
      swatch("primary", "#7FA88E", derived),
      swatch("text", "#3A4A42", "Deep Forest"),
    ];

    const encoded = encodePalette(palette);
    expect(encoded).not.toContain(derived);
    expect(decodePalette(encoded)).toEqual(palette);
  });
});

describe("share URL", () => {
  it("round-trips through a real URL, query string and all", () => {
    const url = paletteShareUrl(
      TEN_COLOR_PALETTE,
      "https://brancol.app/studio?ref=email#swatch-3",
    );
    const parsed = new URL(url);

    expect(parsed.searchParams.get("ref")).toBe("email");
    expect(parsed.hash).toBe("");
    expect(decodePaletteFromSearch(parsed.search)).toEqual(TEN_COLOR_PALETTE);
  });

  it("reports its own size", () => {
    const encoded = encodePalette(TEN_COLOR_PALETTE);
    const url = paletteShareUrl(TEN_COLOR_PALETTE, "https://brancol.app/");

    // Well inside every practical limit: ~2,000 characters in old IE, 8,000 in
    // nginx, and what actually matters — a link that survives being pasted
    // into a chat window without being wrapped.
    expect(encoded.length).toBeLessThan(400);
    expect(url.length).toBeLessThan(600);
  });

  it("uses the palette parameter", () => {
    const url = new URL(
      paletteShareUrl(SAMPLE_PALETTE, "https://brancol.app/"),
    );
    expect(url.searchParams.get(PALETTE_PARAM)).toBe(
      encodePalette(SAMPLE_PALETTE),
    );
  });
});

describe("malformed links", () => {
  const junk: unknown[] = [
    null,
    undefined,
    42,
    {},
    "",
    "   ",
    "hello world",
    // Wrong version prefix.
    "27fa88e000",
    // Truncated mid-token.
    "17fa88e0",
    // Hex that is not hex.
    "1zzzzzz000",
    // Role index past the end of ROLES (and past the locked range).
    "17fa88ez000",
    // Name length longer than the payload that follows it.
    "17fa88e0zzMeadow",
    // Only one color — below the minimum a palette can be.
    "17fa88e000",
    // Eleven colors: more than the cap.
    `1${"7fa88e000".repeat(11)}`,
    // A name length that is not base-36 digits.
    "17fa88e0--Meadow",
  ];

  it.each(junk.map((value) => [JSON.stringify(value) ?? "undefined", value]))(
    "returns null for %s without throwing",
    (_label, value) => {
      expect(() => decodePalette(value as string)).not.toThrow();
      expect(decodePalette(value as string)).toBeNull();
    },
  );

  it("returns null when the query string has no palette at all", () => {
    expect(decodePaletteFromSearch("?ref=email")).toBeNull();
    expect(decodePaletteFromSearch("")).toBeNull();
    expect(decodePaletteFromSearch(undefined)).toBeNull();
  });

  it("rejects a payload whose name field runs past the end", () => {
    const valid = encodePalette(TWO_COLOR_PALETTE);
    expect(decodePalette(valid.slice(0, valid.length - 3))).toBeNull();
  });

  it("never hands back a color the rest of the app cannot render", () => {
    const decoded = decodePalette(encodePalette(SAMPLE_PALETTE))!;
    for (const color of decoded) {
      expect(color).toEqual({
        ...completeColor(color.hex),
        role: color.role,
        name: color.name,
        locked: color.locked,
      });
    }
  });
});

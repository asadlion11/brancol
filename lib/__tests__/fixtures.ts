/**
 * Shared palette fixtures.
 *
 * Not a test file (Vitest only collects `*.test.ts`), just the sample data the
 * export, URL, storage and variant suites all work from — so a change in one
 * of them cannot quietly be tested against a different palette than another.
 */

import { completeColor } from "../color";
import { ROLES, type Color, type Role } from "../types";

export function swatch(
  role: Role,
  hex: string,
  name: string,
  locked = false,
): Color {
  return { role, name, ...completeColor(hex), locked };
}

/**
 * The reference palette: a calm, warm five-color system. Every export sample
 * in the Phase 5 report is generated from exactly this.
 */
export const SAMPLE_PALETTE: Color[] = [
  swatch("primary", "#7FA88E", "Meadow Sage"),
  swatch("secondary", "#A8C5C9", "Morning Mist"),
  swatch("accent", "#D9A59A", "Sunset Clay"),
  swatch("background", "#F6F2EB", "Warm Linen"),
  swatch("text", "#3A4A42", "Deep Forest"),
];

/** Ten colors — the cap — with one locked, for length and round-trip checks. */
export const TEN_COLOR_PALETTE: Color[] = [
  swatch("primary", "#7FA88E", "Meadow Sage"),
  swatch("secondary", "#A8C5C9", "Morning Mist"),
  swatch("tertiary", "#C7B9A5", "Dry Grass"),
  swatch("accent", "#D9A59A", "Sunset Clay", true),
  swatch("highlight", "#E8C56B", "Low Sun"),
  swatch("background", "#F6F2EB", "Warm Linen"),
  swatch("surface", "#ECE6DB", "Raw Paper"),
  swatch("border", "#D5CCBE", "Field Edge"),
  swatch("text", "#3A4A42", "Deep Forest"),
  swatch("muted", "#8A9690", "River Stone"),
];

/** The role list in declaration order, for exhaustiveness checks. */
export const ALL_ROLES: readonly Role[] = ROLES;

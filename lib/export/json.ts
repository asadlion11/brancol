/**
 * brancol — JSON export.
 *
 * The lossless one. Every swatch goes out whole: role, human name, all four
 * format strings, and its lock state — so this file is the only export that
 * can be read straight back in and become the same palette again.
 *
 * Nothing is timestamped and nothing is machine-specific, so the same palette
 * always produces the same bytes; two exports diff cleanly in a repo.
 *
 * Client-safe: no `server-only`, no Node built-ins.
 */

import type { Color } from "../types";

/** Bumped only if the shape changes in a way a reader would have to notice. */
export const JSON_EXPORT_VERSION = 1;

export type JsonExport = {
  version: number;
  /** Every generated color, in display order. */
  colors: Color[];
};

export function toJsonExport(palette: Color[]): JsonExport {
  return {
    version: JSON_EXPORT_VERSION,
    // Copied field by field, in a fixed key order, so the output is stable
    // whatever order the object happened to be built in upstream.
    colors: palette.map(({ role, name, hex, rgb, hsl, oklch, locked }) => ({
      role,
      name,
      hex,
      rgb,
      hsl,
      oklch,
      locked,
    })),
  };
}

export function exportJson(palette: Color[]): string {
  return `${JSON.stringify(toJsonExport(palette), null, 2)}\n`;
}

/**
 * brancol — W3C Design Tokens export.
 *
 * The interchange format, for the half of the team that does not open a code
 * editor. Follows the Design Tokens Community Group draft: every leaf carries
 * `$type: "color"` and `$value`, groups are plain nesting, and the human name
 * rides in `$description`.
 *
 * `$type` is repeated on every token rather than declared once on the group.
 * The DTCG spec allows group-level inheritance; several importers — Figma's
 * variables importer among them — do not implement it, and a token without a
 * resolvable type is skipped on import. Repeating four characters is cheaper
 * than an export that silently drops half the palette.
 *
 * Export only. A Figma *plugin* is explicitly out of scope (spec §9).
 *
 * Client-safe: no `server-only`, no Node built-ins.
 */

import { deriveVariant } from "../variants";
import type { Color } from "../types";

export type DesignToken = {
  $type: "color";
  /** Uppercase `#RRGGBB`. DTCG's color type accepts a hex string. */
  $value: string;
  $description?: string;
};

export type TokenGroup = Record<string, DesignToken>;

export type TokenDocument = {
  color: TokenGroup;
  /** Present only when `includeDark` is set. */
  "color-dark"?: TokenGroup;
};

export type TokensExportOptions = {
  /** Add a second group holding the derived dark-mode values. */
  includeDark?: boolean;
};

function group(palette: Color[]): TokenGroup {
  const tokens: TokenGroup = {};
  const used = new Set<string>();

  for (const color of palette) {
    let key = color.role as string;
    for (let n = 2; used.has(key); n += 1) key = `${color.role}-${n}`;
    used.add(key);

    tokens[key] = {
      $type: "color",
      $value: color.hex,
      $description: color.name,
    };
  }

  return tokens;
}

export function toTokenDocument(
  palette: Color[],
  options: TokensExportOptions = {},
): TokenDocument {
  const document: TokenDocument = { color: group(palette) };

  if (options.includeDark) {
    document["color-dark"] = group(deriveVariant(palette, "dark"));
  }

  return document;
}

export function exportTokens(
  palette: Color[],
  options: TokensExportOptions = {},
): string {
  return `${JSON.stringify(toTokenDocument(palette, options), null, 2)}\n`;
}

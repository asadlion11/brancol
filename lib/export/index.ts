/**
 * brancol — the export registry.
 *
 * One list, four formats. The dialog renders whatever is in here, so adding a
 * format is a single entry rather than a new tab, a new button and a new
 * download handler.
 *
 * Client-safe: no `server-only`, no Node built-ins.
 */

import type { Color } from "../types";
import { exportCss } from "./css";
import { exportJson } from "./json";
import { exportTailwind } from "./tailwind";
import { exportTokens } from "./tokens";

export * from "./css";
export * from "./json";
export * from "./tailwind";
export * from "./tokens";

export type ExportFormatId = "css" | "json" | "tailwind" | "tokens";

export type ExportFormat = {
  id: ExportFormatId;
  /** Tab label. */
  label: string;
  /** One line under the tab saying what this file is for. */
  hint: string;
  filename: string;
  mediaType: string;
  render: (palette: Color[]) => string;
};

export const EXPORT_FORMATS: readonly ExportFormat[] = [
  {
    id: "css",
    label: "CSS",
    hint: "Custom properties on :root, with a derived dark-mode block.",
    filename: "brancol-palette.css",
    mediaType: "text/css",
    render: (palette) => exportCss(palette),
  },
  {
    id: "json",
    label: "JSON",
    hint: "Every swatch whole — role, name, HEX, RGB, HSL, OKLCH.",
    filename: "brancol-palette.json",
    mediaType: "application/json",
    render: (palette) => exportJson(palette),
  },
  {
    id: "tailwind",
    label: "Tailwind",
    hint: "A v4 @theme block and a v3 config. Use whichever you run.",
    filename: "brancol-tailwind.txt",
    mediaType: "text/plain",
    render: (palette) => exportTailwind(palette),
  },
  {
    id: "tokens",
    label: "Tokens",
    hint: "W3C design tokens. Imports into Figma variables.",
    filename: "brancol-tokens.json",
    mediaType: "application/json",
    render: (palette) => exportTokens(palette),
  },
];

export function exportFormat(id: ExportFormatId): ExportFormat {
  return EXPORT_FORMATS.find((format) => format.id === id) ?? EXPORT_FORMATS[0];
}

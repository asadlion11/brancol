/**
 * brancol — JSON extraction and repair for model output.
 *
 * Free models do not reliably honour "return only JSON": they wrap it in
 * ```json fences, chat about the palette first, leave trailing commas, use
 * single quotes, or nest the array under a key they invented. This module is
 * the guard that none of that reaches the UI.
 *
 * It only ever *recovers* structure — it never invents colors. When nothing
 * usable can be extracted it returns `null`, which tells the adapter to fail
 * over to the next model (see `lib/ai/adapter.ts`).
 *
 * Client-safe by design so it can be unit-tested without a server context.
 */

import { normalizeHex } from "../color";
import { aiColorSchema, type AIColor } from "../schemas";

/** Removes ```json … ``` fences (and stray leading language tags). */
export function stripCodeFences(raw: string): string {
  const fenced = raw.match(/```(?:json5?|javascript|js|ts)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  // An unterminated fence — the model ran out of tokens before closing it.
  const opened = raw.match(/```(?:json5?|javascript|js|ts)?\s*([\s\S]*)$/i);
  if (opened?.[1]) return opened[1].trim();

  return raw.trim();
}

/**
 * Returns every balanced `{...}` / `[...]` slice in the text, longest first, so
 * prose before or after the JSON is simply ignored.
 */
export function jsonSlices(text: string): string[] {
  const slices: string[] = [];

  for (let start = 0; start < text.length; start += 1) {
    const open = text[start];
    if (open !== "{" && open !== "[") continue;

    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let quote = "";
    let escaped = false;

    for (let i = start; i < text.length; i += 1) {
      const char = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (inString) {
        if (char === "\\") escaped = true;
        else if (char === quote) inString = false;
        continue;
      }
      if (char === '"' || char === "'") {
        inString = true;
        quote = char;
        continue;
      }
      if (char === open) depth += 1;
      else if (char === close) {
        depth -= 1;
        if (depth === 0) {
          slices.push(text.slice(start, i + 1));
          break;
        }
      }
    }
  }

  return slices.sort((a, b) => b.length - a.length);
}

/**
 * Best-effort textual repairs, applied only after a strict parse has failed:
 * comments, trailing commas, single-quoted strings, unquoted keys, smart
 * quotes, and Python-flavoured literals.
 */
export function repairJsonText(input: string): string {
  let text = input;

  // Smart quotes the model copied out of prose.
  text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // Line and block comments.
  text = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'])\/\/[^\n\r]*/g, "$1");

  // Single-quoted strings → double-quoted (escaping any inner double quotes).
  text = text.replace(/'((?:[^'\\]|\\.)*)'/g, (_match, body: string) => {
    return `"${body.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`;
  });

  // Unquoted object keys: `{ role: "primary" }`.
  text = text.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3');

  // Python / JS literals that are not valid JSON.
  text = text.replace(/\b(True|False)\b/g, (m) => m.toLowerCase());
  text = text.replace(/\b(None|undefined|NaN)\b/g, "null");

  // Trailing commas before a closing brace or bracket.
  text = text.replace(/,(\s*[}\]])/g, "$1");

  return text.trim();
}

/** Parses model output into a JSON value, repairing along the way. Returns `null` if hopeless. */
export function parseLooseJson(raw: string): unknown {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;

  const attempts: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length > 0 && !attempts.includes(trimmed))
      attempts.push(trimmed);
  };

  push(raw);
  const unfenced = stripCodeFences(raw);
  push(unfenced);
  for (const slice of jsonSlices(unfenced)) push(slice);
  for (const slice of jsonSlices(raw)) push(slice);

  // Strict first, so well-formed output is never mangled by the repairs.
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // fall through to the repaired pass
    }
  }

  for (const attempt of attempts) {
    const repaired = repairJsonText(attempt);
    try {
      return JSON.parse(repaired);
    } catch {
      continue;
    }
    // Repairs can also expose a valid slice inside broken surroundings.
  }

  for (const attempt of attempts) {
    for (const slice of jsonSlices(repairJsonText(attempt))) {
      try {
        return JSON.parse(slice);
      } catch {
        continue;
      }
    }
  }

  return null;
}

/** Keys a model might use instead of `colors`. */
const ARRAY_KEYS = [
  "colors",
  "palette",
  "swatches",
  "colours",
  "colorPalette",
  "result",
  "data",
  "items",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Finds the color array inside whatever envelope the model chose. */
function locateArray(value: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!isRecord(value) || depth > 3) return null;

  for (const key of ARRAY_KEYS) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate;
    if (isRecord(candidate)) {
      const nested = locateArray(candidate, depth + 1);
      if (nested) return nested;
    }
  }

  // Any array of objects/strings will do if it is the only one present.
  const arrays = Object.values(value).filter(Array.isArray);
  if (arrays.length === 1) return arrays[0];

  // `{ "primary": "#123456", "accent": "#abc" }` — a role-keyed map.
  const mapped = Object.entries(value)
    .filter(([, entry]) => typeof entry === "string" || isRecord(entry))
    .map(([role, entry]) =>
      typeof entry === "string"
        ? { role, hex: entry }
        : { role, ...(entry as Record<string, unknown>) },
    )
    .filter((entry) => normalizeHex((entry as { hex?: unknown }).hex) !== null);

  return mapped.length > 0 ? mapped : null;
}

/** Pulls a usable hex out of an entry that may be a string, or use an odd key name. */
function entryHex(entry: unknown): string | null {
  if (typeof entry === "string") return normalizeHex(entry);
  if (!isRecord(entry)) return null;

  for (const key of [
    "hex",
    "hexCode",
    "hex_code",
    "value",
    "color",
    "colour",
    "code",
  ]) {
    const hex = normalizeHex(entry[key]);
    if (hex) return hex;
  }
  return null;
}

function entryString(entry: unknown, keys: string[]): string | undefined {
  if (!isRecord(entry)) return undefined;
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "string" && value.trim().length > 0)
      return value.trim();
  }
  return undefined;
}

/**
 * The single entry point used by the adapter: raw model text → validated
 * `AIColor[]`, or `null` to trigger failover.
 *
 * Extra keys are dropped, and any rgb/hsl/oklch the model volunteered is
 * ignored — the server recomputes color math from the hex (locked decision L14).
 */
export function extractPalette(raw: string): AIColor[] | null {
  const parsed = parseLooseJson(raw);
  if (parsed === null) return null;

  const array = locateArray(parsed);
  if (!array || array.length === 0) return null;

  const colors: AIColor[] = [];
  for (const entry of array) {
    const hex = entryHex(entry);
    if (!hex) continue;

    const candidate = aiColorSchema.safeParse({
      hex,
      role: entryString(entry, ["role", "type", "usage", "purpose", "slot"]),
      name: entryString(entry, ["name", "label", "title"]),
    });
    if (candidate.success) colors.push(candidate.data);
  }

  return colors.length > 0 ? colors : null;
}

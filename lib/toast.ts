"use client";

import { toast } from "sonner";

/**
 * Normalize any hex form (`6c4cf1`, `#6c4cf1`, `#6C4CF1FF`, `#abc`) to the
 * canonical `#RRGGBB` uppercase used everywhere in the UI and in toasts.
 * Returns the trimmed input untouched if it is not a hex string.
 */
export function normalizeHex(hex: string): string {
  const raw = hex.trim().replace(/^#/, "");

  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(raw) || /^[0-9a-fA-F]{8}$/.test(raw)) {
    return `#${raw.slice(0, 6)}`.toUpperCase();
  }

  return hex.trim();
}

/**
 * The copy confirmation. Wording is fixed by the spec: `Copied #6C4CF1`.
 * Nothing else — no "to clipboard", no punctuation, no title/description
 * split.
 */
export function toastCopiedHex(hex: string): void {
  toast(`Copied ${normalizeHex(hex)}`);
}

/** Confirmation for non-colour copies (an export blob, a token file). */
export function toastCopied(label: string): void {
  toast(`Copied ${label}`);
}

export function toastError(message: string): void {
  toast.error(message);
}

/**
 * Copy a hex to the clipboard and confirm it. Returns false (and surfaces an
 * error toast) when the Clipboard API is unavailable or refused — an
 * insecure origin, or a denied permission — rather than silently claiming
 * success.
 */
export async function copyHex(hex: string): Promise<boolean> {
  const value = normalizeHex(hex);

  try {
    await navigator.clipboard.writeText(value);
    toastCopiedHex(value);
    return true;
  } catch {
    toastError(`Couldn't copy ${value}`);
    return false;
  }
}

/** Copy arbitrary text (an export payload) and confirm with `label`. */
export async function copyText(text: string, label: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toastCopied(label);
    return true;
  } catch {
    toastError(`Couldn't copy ${label}`);
    return false;
  }
}

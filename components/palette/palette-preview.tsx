"use client";

import * as React from "react";
import { ArrowRightIcon, MoonIcon, SunIcon } from "lucide-react";

import { bestForeground, luminance, meetsAA } from "@/lib/contrast";
import type { Color, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { variantPair, type Scheme } from "@/lib/variants";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Hairline } from "@/components/ui/hairline";

/**
 * The palette, doing a job.
 *
 * A rail of bands answers "what are the colors". It cannot answer "is the
 * muted text still readable on the surface card", "does the primary button
 * actually pop against that background", or "is the accent too loud at this
 * size" — and those are the questions that decide whether a system ships. So
 * the same tokens get poured into a small, ordinary interface: a nav, two
 * buttons, a card, a paragraph, a caption.
 *
 * Every colour below comes from a ROLE. Nothing is hard-coded, nothing is a
 * page token, and nothing is invented — a role that the palette does not
 * contain falls back to one that it does, or to a mix of two that it does
 * (see `previewTheme`). A two-color palette produces a legible preview for
 * the same reason a ten-color one does.
 *
 * The dark counterpart is derived, not generated: `variantPair` from
 * `lib/variants.ts` holds every hue to the degree and only remaps lightness,
 * so the switch shows the *same* system at the other end of the L axis rather
 * than a second palette wearing the same names.
 */

/** A CSS colour value — a real hex, or a `color-mix()` of two real hexes. */
type Paint = string;

type PreviewTheme = {
  background: Paint;
  surface: Paint;
  border: Paint;
  text: Paint;
  muted: Paint;
  primary: string;
  primaryInk: string;
  secondary: string;
  accent: string;
  accentInk: string;
};

/**
 * A blend of two palette colours, done by the browser in OKLab.
 *
 * Only ever used for the three roles a palette may legitimately omit and that
 * a designer would themselves mix rather than pick — a surface a few percent
 * off the ground, a hairline, a second-rank ink. Brand and semantic roles are
 * never synthesized: if `primary` is missing, another *real* colour stands in.
 */
function mix(a: Paint, b: Paint, percent: number): Paint {
  return `color-mix(in oklab, ${a} ${percent}%, ${b})`;
}

/** The first of these roles the palette actually contains. */
function pick(palette: Color[], ...roles: Role[]): string | null {
  for (const role of roles) {
    const found = palette.find((color) => color.role === role);
    if (found) return found.hex;
  }
  return null;
}

/** Palette sorted lightest first — the fallback ordering for the grounds. */
function byLightness(palette: Color[]): Color[] {
  return [...palette].sort((a, b) => luminance(b.hex) - luminance(a.hex));
}

/** Maps a palette's roles onto the slots this mock needs. */
export function previewTheme(palette: Color[]): PreviewTheme {
  const ramp = byLightness(palette);
  const background =
    pick(palette, "background", "surface") ?? ramp.at(0)?.hex ?? "#FFFFFF";

  // Ink has to be readable before it is faithful. A `text` role that cannot
  // clear AA on this ground would make the preview a worse guide than no
  // preview at all, so the audit result stands in instead — and the rail's
  // own AA notice is where that disagreement is reported.
  const declaredText = pick(palette, "text");
  const text =
    declaredText && meetsAA(declaredText, background)
      ? declaredText
      : (ramp.findLast((color) => meetsAA(color.hex, background))?.hex ??
        bestForeground(background).hex);

  const primary =
    pick(palette, "primary", "accent", "secondary", "highlight") ?? text;
  const accent =
    pick(palette, "accent", "highlight", "tertiary", "secondary") ?? primary;

  return {
    background,
    surface: pick(palette, "surface") ?? mix(text, background, 5),
    border: pick(palette, "border") ?? mix(text, background, 16),
    text,
    muted: pick(palette, "muted") ?? mix(text, background, 62),
    primary,
    primaryInk: bestForeground(primary).hex,
    secondary: pick(palette, "secondary", "tertiary", "primary") ?? primary,
    accent,
    accentInk: bestForeground(accent).hex,
  };
}

/**
 * The light/dark switch.
 *
 * Two buttons rather than a single toggle: the two modes are peers, and a
 * one-button toggle would have to name the mode you are *not* in, which is the
 * classic way to leave a user unsure which state they are looking at.
 */
function SchemeSwitch({
  scheme,
  onChange,
}: {
  scheme: Scheme;
  onChange: (next: Scheme) => void;
}) {
  const options: ReadonlyArray<{
    value: Scheme;
    label: string;
    Icon: typeof SunIcon;
  }> = [
    { value: "light", label: "Light", Icon: SunIcon },
    { value: "dark", label: "Dark", Icon: MoonIcon },
  ];

  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label="Preview mode"
    >
      {options.map(({ value, label, Icon }) => (
        <Button
          key={value}
          type="button"
          variant={scheme === value ? "secondary" : "ghost"}
          size="xs"
          aria-pressed={scheme === value}
          onClick={() => onChange(value)}
          className="uppercase"
        >
          <Icon aria-hidden />
          {label}
          <span className="sr-only"> preview</span>
        </Button>
      ))}
    </div>
  );
}

/** A button drawn entirely in palette colours. */
function MockButton({
  children,
  background,
  color,
  border,
}: {
  children: React.ReactNode;
  background: Paint;
  color: Paint;
  border?: Paint;
}) {
  return (
    <span
      // Not a real <button>: the preview is a picture of an interface, and a
      // row of live-looking controls that do nothing would be a trap for
      // anyone tabbing through the page.
      aria-hidden
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-label font-medium"
      style={{
        backgroundColor: background,
        color,
        borderColor: border ?? background,
      }}
    >
      {children}
    </span>
  );
}

export function PalettePreview({
  palette,
  scheme,
  onSchemeChange,
}: {
  palette: Color[];
  scheme: Scheme;
  onSchemeChange: (next: Scheme) => void;
}) {
  const pair = React.useMemo(() => variantPair(palette), [palette]);
  const active = scheme === "dark" ? pair.dark : pair.light;
  const theme = React.useMemo(() => previewTheme(active), [active]);

  if (palette.length === 0) return null;

  return (
    <>
      <Hairline />

      <Container size="wide" className="py-8 sm:py-10">
        <section aria-labelledby="preview-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
            <div>
              <h2
                id="preview-heading"
                className="type-eyebrow text-muted-foreground"
              >
                In context
              </h2>
              <p className="mt-2 max-w-md text-label text-muted-foreground">
                The same roles, used the way an interface uses them. The dark
                mode is derived from this palette, not generated separately.
              </p>
            </div>

            <SchemeSwitch scheme={scheme} onChange={onSchemeChange} />
          </div>

          <div
            // Radius is allowed here: this is a card, not a colour field.
            className="mt-6 overflow-hidden rounded-lg border"
            style={{
              backgroundColor: theme.background,
              borderColor: theme.border,
              color: theme.text,
            }}
          >
            {/* Nav */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
              style={{ borderColor: theme.border }}
            >
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <span
                  aria-hidden
                  className="font-heading text-heading leading-none font-semibold tracking-tight lowercase"
                >
                  brancol
                </span>
                <span
                  aria-hidden
                  className="flex flex-wrap gap-x-4 gap-y-1 text-label"
                  style={{ color: theme.muted }}
                >
                  <span style={{ color: theme.text }}>Overview</span>
                  <span>Systems</span>
                  <span>Docs</span>
                </span>
              </div>

              <MockButton background={theme.primary} color={theme.primaryInk}>
                Get started
              </MockButton>
            </div>

            {/* Body */}
            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <p
                  aria-hidden
                  className="type-eyebrow"
                  style={{ color: theme.muted }}
                >
                  Release 2.4
                </p>

                <p
                  aria-hidden
                  className="mt-3 text-title text-balance"
                  style={{ color: theme.text }}
                >
                  A color system you can actually build with.
                </p>

                <p
                  aria-hidden
                  className="mt-3 max-w-prose text-body"
                  style={{ color: theme.text }}
                >
                  Body copy sits on the background role. If this paragraph is
                  hard to read here, it will be hard to read in the product —
                  which is the whole reason this block exists.
                </p>

                <p
                  aria-hidden
                  className="mt-2 max-w-prose text-label"
                  style={{ color: theme.muted }}
                >
                  Muted text carries the secondary line: timestamps, captions,
                  helper copy under a field.
                </p>

                <div
                  aria-hidden
                  className="mt-5 flex flex-wrap items-center gap-2"
                >
                  <MockButton
                    background={theme.primary}
                    color={theme.primaryInk}
                  >
                    Primary action
                    <ArrowRightIcon aria-hidden className="size-3.5" />
                  </MockButton>
                  <MockButton
                    background="transparent"
                    color={theme.text}
                    border={theme.border}
                  >
                    Secondary
                  </MockButton>
                </div>
              </div>

              {/* Card */}
              <div
                aria-hidden
                className="rounded-lg border p-4 lg:col-span-2"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-heading" style={{ color: theme.text }}>
                    Surface card
                  </p>
                  <span
                    className="inline-flex items-center rounded-sm px-1.5 py-0.5 type-eyebrow"
                    style={{
                      backgroundColor: theme.accent,
                      color: theme.accentInk,
                    }}
                  >
                    Accent
                  </span>
                </div>

                <p className="mt-2 text-label" style={{ color: theme.muted }}>
                  Cards sit one step off the ground. This is where the surface
                  and border roles earn their place.
                </p>

                <div
                  className="mt-4 border-t pt-3 text-label"
                  style={{ borderColor: theme.border, color: theme.secondary }}
                >
                  A link in the secondary role
                </div>
              </div>
            </div>
          </div>

          <p
            className={cn(
              "mt-3 text-micro tracking-[0.09em] text-muted-foreground uppercase",
            )}
          >
            Preview only — nothing here is interactive
          </p>
        </section>
      </Container>
    </>
  );
}

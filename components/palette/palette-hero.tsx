"use client";

import * as React from "react";

import { bestForeground } from "@/lib/contrast";
import { cn } from "@/lib/utils";
import type { Color, PaletteMeta } from "@/lib/types";
import { Container } from "@/components/ui/container";
import { Hairline } from "@/components/ui/hairline";
import { BandRail, BandShell, bandIndex } from "@/components/palette/band";

/**
 * The hero: the generated palette *is* the page.
 *
 * Every foreground here comes from `bestForeground(band.hex)` — ink or paper,
 * whichever actually reads on that swatch. Hard-coding white would put the
 * caption's legibility at the mercy of whatever the model mixed.
 */

type BandProps = {
  color: Color;
  index: number;
};

function PaletteBandContent({ color, index }: BandProps) {
  const foreground = bestForeground(color.hex);

  return (
    <BandShell
      role="listitem"
      style={{ backgroundColor: color.hex, color: foreground.hex }}
      // A band is a figure, not a control: one accessible label rather than
      // three unrelated fragments read in sequence.
      aria-label={`${color.role} — ${color.name}, ${color.hex}`}
    >
      <span aria-hidden className="type-hex text-micro opacity-55">
        {bandIndex(index)}
      </span>

      <span aria-hidden className="mt-8 flex flex-col md:mt-0">
        <span className="type-eyebrow opacity-75">{color.role}</span>
        <span
          className={cn(
            "mt-1 text-label leading-snug text-balance",
            // Below AA the caption is the first thing to go soft, so it gets
            // the extra weight rather than a scrim that would dirty the field.
            foreground.passesAA ? "font-medium" : "font-semibold",
          )}
        >
          {color.name}
        </span>
        <span className="mt-0.5 type-hex text-label opacity-90">
          {color.hex}
        </span>
      </span>
    </BandShell>
  );
}

type PaletteHeroProps = {
  palette: Color[];
  meta: PaletteMeta | null;
};

export function PaletteHero({ palette, meta }: PaletteHeroProps) {
  return (
    <>
      <BandRail
        role="list"
        aria-label={`Generated palette, ${palette.length} colors`}
      >
        {palette.map((color, index) => (
          <PaletteBandContent
            key={`${color.role}-${color.hex}-${index}`}
            color={color}
            index={index}
          />
        ))}
      </BandRail>

      <Hairline />
      <Container
        size="wide"
        className="flex flex-col gap-1 py-4 text-micro tracking-[0.09em] text-muted-foreground uppercase sm:flex-row sm:items-center sm:justify-between"
      >
        <p>{palette.length} colors · HEX · RGB · HSL · OKLCH</p>
        {meta ? (
          <p>
            {meta.model}
            {meta.fallbackUsed ? " (fallback)" : ""} ·{" "}
            {(meta.durationMs / 1000).toFixed(1)}s
          </p>
        ) : null}
      </Container>
    </>
  );
}

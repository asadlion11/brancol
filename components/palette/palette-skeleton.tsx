"use client";

import * as React from "react";

import { Container } from "@/components/ui/container";
import { Hairline } from "@/components/ui/hairline";
import { BandRail, BandShell, bandIndex } from "@/components/palette/band";

/**
 * The wait.
 *
 * Generation is a 7–17 second round trip on the free tier, which is far too
 * long for a spinner. So the poster is built first and colored second: the
 * skeleton is the *same* `BandRail` / `BandShell` at the *requested* count,
 * with caption blocks on the same baselines as the real captions. When the
 * response lands, color replaces gray and not one pixel of layout moves.
 *
 * The bands settle in sequence rather than all at once — that is progress
 * feedback, not decoration, and the reduced-motion kill switch in globals.css
 * removes it for anyone who has asked for stillness.
 */

/** Seconds since mount, for the "still working" readout. */
function useElapsedSeconds(): number {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return seconds;
}

export function SkeletonBand({ index }: { index: number }) {
  // A shallow ramp so ten placeholders read as ten distinct fields rather
  // than one long gray rectangle.
  const tint = 62 + (index % 4) * 9;

  return (
    <BandShell
      aria-hidden
      className="animate-pulse"
      style={{
        backgroundColor: `color-mix(in oklab, var(--muted) ${tint}%, var(--background))`,
        // Staggered so the eye reads left-to-right progress rather than a
        // single flat blink.
        animationDelay: `${index * 110}ms`,
      }}
    >
      <span
        aria-hidden
        className="type-hex text-micro text-muted-foreground/70"
      >
        {bandIndex(index)}
      </span>

      <span aria-hidden className="mt-8 flex flex-col md:mt-0">
        <span className="h-[0.9rem] w-10 bg-foreground/12" />
        <span className="mt-1 h-[1.18rem] w-24 max-w-full bg-foreground/12" />
        <span className="mt-0.5 h-[1.18rem] w-16 bg-foreground/12" />
      </span>
    </BandShell>
  );
}

/**
 * The "still working" readout under the rail.
 *
 * Shared with the hero, which shows the same line while it holds locked bands
 * on screen — one wait, stated the same way wherever it happens.
 */
export function MixingStatus({
  mixing,
  held = 0,
}: {
  mixing: number;
  held?: number;
}) {
  const seconds = useElapsedSeconds();

  return (
    <>
      <Hairline />
      <Container
        size="wide"
        role="status"
        aria-live="polite"
        className="flex flex-col gap-1 py-4 text-micro tracking-[0.09em] text-muted-foreground uppercase sm:flex-row sm:items-center sm:justify-between"
      >
        <p>
          Mixing {mixing} colors — this takes a few seconds
          {held > 0 ? ` · ${held} locked and kept` : ""}
        </p>
        <p className="tabular-nums">{seconds}s</p>
      </Container>
    </>
  );
}

/**
 * The wait with nothing to hold: no palette yet, or none of it pinned. Every
 * slot is a placeholder, so the rail is decorative and hidden from assistive
 * technology outright.
 */
export function PaletteSkeleton({ count }: { count: number }) {
  return (
    <>
      <BandRail aria-hidden>
        {Array.from({ length: count }, (_, index) => (
          <SkeletonBand key={`slot-${index}`} index={index} />
        ))}
      </BandRail>

      <MixingStatus mixing={count} />
    </>
  );
}

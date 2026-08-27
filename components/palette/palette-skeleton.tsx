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

function SkeletonBand({ index }: { index: number }) {
  // A shallow ramp so ten placeholders read as ten distinct fields rather
  // than one long gray rectangle.
  const tint = 62 + (index % 4) * 9;

  return (
    <BandShell
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

export function PaletteSkeleton({ count }: { count: number }) {
  const seconds = useElapsedSeconds();

  return (
    <>
      <BandRail aria-hidden>
        {Array.from({ length: count }, (_, index) => (
          <SkeletonBand key={index} index={index} />
        ))}
      </BandRail>

      <Hairline />
      <Container
        size="wide"
        role="status"
        aria-live="polite"
        className="flex flex-col gap-1 py-4 text-micro tracking-[0.09em] text-muted-foreground uppercase sm:flex-row sm:items-center sm:justify-between"
      >
        <p>Mixing {count} colors — this takes a few seconds</p>
        <p className="tabular-nums">{seconds}s</p>
      </Container>
    </>
  );
}

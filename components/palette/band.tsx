import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The geometry of the hero, in one place.
 *
 * `BandRail` and `BandShell` are shared verbatim by the real palette and by
 * the loading skeleton. That is the whole point: the skeleton is not a
 * lookalike, it is the same box with no color in it, so nothing moves when the
 * generated bands arrive 7–17 seconds later.
 *
 * Bands are `flex-1` inside the rail, so two colors and ten colors both fill
 * the field exactly — the poster is always complete, only its rhythm changes.
 */

/**
 * The color field. Runs as a column stack on small screens and as vertical
 * bands from `md` up, where it takes the remaining viewport height.
 *
 * Sharp-edged by construction: no radius, no gap, no border. Bands abut.
 */
function BandRail({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="band-rail"
      className={cn(
        "flex w-full flex-1 flex-col",
        "md:min-h-[min(44rem,calc(100svh-11rem))] md:flex-row",
        className,
      )}
      {...props}
    />
  );
}

/**
 * One band. Index at the top, caption at the foot — the two anchors an
 * International-Typographic-Style poster hangs everything else between.
 */
function BandShell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="band"
      className={cn(
        "relative flex min-h-24 flex-1 flex-col justify-between",
        "px-5 py-4 sm:min-h-28 md:px-4 md:py-6",
        className,
      )}
      {...props}
    />
  );
}

/** `01`, `02`, … Swiss numbering, never `1.` */
function bandIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export { BandRail, BandShell, bandIndex };

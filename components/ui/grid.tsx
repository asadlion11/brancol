import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The 12-column Swiss grid.
 *
 * Collapses to 4 columns on small viewports and 8 at `md`, so column spans
 * expressed in twelfths stay meaningful at every width. Asymmetry is the
 * default posture: place things with `<GridItem span start>` rather than
 * splitting the grid into equal halves.
 */
function Grid({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="grid"
      className={cn(
        "grid grid-cols-4 gap-gutter md:grid-cols-8 lg:grid-cols-12",
        className,
      )}
      {...props}
    />
  );
}

type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * `span` / `start` are in twelfths and apply at `lg` and up, where the full
 * 12-column grid exists. Below that a GridItem fills the row unless you pass
 * your own responsive classes.
 */
type GridItemProps = React.ComponentProps<"div"> & {
  span?: Span;
  start?: Span;
};

// Written out rather than interpolated so Tailwind's scanner sees every class.
const spanClass: Record<Span, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  10: "lg:col-span-10",
  11: "lg:col-span-11",
  12: "lg:col-span-12",
};

const startClass: Record<Span, string> = {
  1: "lg:col-start-1",
  2: "lg:col-start-2",
  3: "lg:col-start-3",
  4: "lg:col-start-4",
  5: "lg:col-start-5",
  6: "lg:col-start-6",
  7: "lg:col-start-7",
  8: "lg:col-start-8",
  9: "lg:col-start-9",
  10: "lg:col-start-10",
  11: "lg:col-start-11",
  12: "lg:col-start-12",
};

function GridItem({ className, span, start, ...props }: GridItemProps) {
  return (
    <div
      data-slot="grid-item"
      className={cn(
        "col-span-full",
        span && spanClass[span],
        start && startClass[start],
        className,
      )}
      {...props}
    />
  );
}

export { Grid, GridItem };

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Swiss page measure. Left-aligned by default — the content block sits
 * against the leading edge of the grid rather than being optically centred,
 * which is what keeps asymmetric layouts readable.
 *
 * `bleed` opts out of the max-width entirely, for full-height color fields
 * that must run edge to edge.
 */
type ContainerProps = React.ComponentProps<"div"> & {
  size?: "narrow" | "default" | "wide" | "bleed";
  /** Centre the measure in the viewport instead of pinning it left. */
  centered?: boolean;
};

const sizes: Record<NonNullable<ContainerProps["size"]>, string> = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-[90rem]",
  bleed: "max-w-none",
};

function Container({
  className,
  size = "default",
  centered = false,
  ...props
}: ContainerProps) {
  return (
    <div
      data-slot="container"
      className={cn(
        "w-full px-gutter sm:px-8 lg:px-12",
        sizes[size],
        centered && "mx-auto",
        className,
      )}
      {...props}
    />
  );
}

export { Container };

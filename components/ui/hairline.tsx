import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A 1px rule. The only divider in the system — Swiss layouts separate with
 * a hairline and whitespace, never with a box or a shadow.
 *
 * Purely decorative by default (`role="presentation"`), so screen readers do
 * not announce it. Pass `decorative={false}` when the rule genuinely marks a
 * thematic break, and it renders as a real separator.
 */
type HairlineProps = React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
};

function Hairline({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: HairlineProps) {
  return (
    <div
      data-slot="hairline"
      data-orientation={orientation}
      role={decorative ? "presentation" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Hairline };

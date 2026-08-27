import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The brancol wordmark. Type only — no logo image, no icon.
 *
 * Lowercase Poppins 600, tight tracking, current colour. It stays
 * monochrome on purpose: the chrome recedes so the generated palette is the
 * only colour on the page.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-heading text-heading leading-none font-semibold tracking-tight lowercase",
        className,
      )}
    >
      brancol
    </span>
  );
}

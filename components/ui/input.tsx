import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Brand-tokenized text input. Hairline border, 8px radius, brand focus ring.
 *
 * Two states are load-bearing and therefore deliberately loud:
 *
 * - `aria-invalid="true"` — destructive border **and** ring, visible whether
 *   or not the field has focus. Phase 4 drives this from manual hex editing,
 *   so it has to read as "this value is wrong" at a glance, not only while
 *   the caret is in the field.
 * - `disabled` — muted fill, dimmed text, `not-allowed` cursor. Reads as
 *   inert rather than merely faint.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-body text-foreground md:text-label",
        "transition-[border-color,box-shadow,background-color] duration-150 outline-none",
        "placeholder:text-muted-foreground",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-label file:font-medium file:text-foreground",
        // Focus.
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        // Invalid — visible with or without focus.
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-destructive/25",
        "aria-[invalid=true]:focus-visible:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/35",
        // Disabled.
        "disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:placeholder:text-muted-foreground/60",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Brand-tokenized textarea — the project-description field.
 *
 * Same state contract as `Input`: `aria-invalid="true"` shows a destructive
 * border and ring with or without focus, and `disabled` reads as inert.
 * Grows with its content via `field-sizing-content`.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-body text-foreground md:text-label",
        "transition-[border-color,box-shadow,background-color] duration-150 outline-none",
        "placeholder:text-muted-foreground",
        // Focus.
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        // Invalid — visible with or without focus.
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-destructive/25",
        "aria-[invalid=true]:focus-visible:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/35",
        // Disabled.
        "disabled:cursor-not-allowed disabled:resize-none disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:placeholder:text-muted-foreground/60",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

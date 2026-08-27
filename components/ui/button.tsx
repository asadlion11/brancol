import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Brand-tokenized button.
 *
 * Every colour resolves through the shadcn semantic vars, which globals.css
 * maps onto the brand tokens — so `primary` is Brand Purple in both modes
 * without naming a hex here. Radius is `rounded-lg` = `--radius` = 8px, the
 * small radius the spec allows on controls. Colour fields stay sharp; this
 * is not one.
 *
 * Hover darkens toward Deep Indigo via `color-mix` rather than dropping
 * opacity, so the button never lets the page ground show through.
 */
const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center rounded-lg",
    "border border-transparent bg-clip-padding",
    "text-sm font-medium whitespace-nowrap",
    "transition-[background-color,border-color,color,box-shadow,translate] duration-150",
    "outline-none select-none",
    // A.18: an always-visible keyboard ring, in the brand.
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
    "active:not-aria-[haspopup]:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-45",
    "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/25",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /** Brand Purple. The one call to action on a screen. */
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--brand-secondary))]",
        /** Explicit alias for `default`, for call sites that want to say it. */
        primary:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--brand-secondary))]",
        /** Hairline-bordered. Secondary actions next to a primary. */
        outline:
          "border-border bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--secondary)_92%,var(--foreground))] aria-expanded:bg-secondary",
        /** No chrome until touched. The quiet default for header/toolbars. */
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "bg-transparent text-destructive hover:bg-destructive/10 focus-visible:border-destructive focus-visible:ring-destructive/25",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-md px-2 text-xs in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-md px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-[0.9375rem]",
        /** Square icon-only. Always pair with an `sr-only` label. */
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

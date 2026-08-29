"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Tabs, Swiss.
 *
 * Not a pill group and not a segmented control: a row of quiet labels sitting
 * on a hairline, with the active one marked by a 2px rule directly under it.
 * The rule is the only chrome — no fill, no radius, no shadow — so the tab
 * strip reads as part of the same rule system as every other divider on the
 * page rather than as a widget dropped onto it.
 *
 * Radix owns the roving-tabindex and the `tab`/`tabpanel` wiring; everything
 * here is presentation.
 */

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // Scrolls rather than wraps at 320px, so four labels never push the
        // dialog wider than the viewport.
        "-mb-px flex w-full items-stretch gap-5 overflow-x-auto border-b border-border",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative -mb-px shrink-0 border-b-2 border-transparent pb-2.5 type-eyebrow",
        "whitespace-nowrap text-muted-foreground transition-colors duration-150",
        "hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "data-[state=active]:border-foreground data-[state=active]:text-foreground",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex flex-col gap-3 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };

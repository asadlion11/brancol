import * as React from "react";

/**
 * First focusable thing on the page. Invisible until it takes keyboard
 * focus, then it becomes a normal brand button pinned to the top-left.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:inline-flex focus-visible:h-9 focus-visible:items-center focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-3 focus-visible:text-label focus-visible:font-medium focus-visible:text-primary-foreground"
    >
      Skip to content
    </a>
  );
}

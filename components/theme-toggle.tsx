"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Light/dark switch.
 *
 * Which icon shows is decided by CSS (`dark:` variants), not by React state,
 * so the button renders identically on the server and the client and there
 * is no hydration mismatch and no post-mount icon swap. The click handler
 * only ever runs in the browser, where `resolvedTheme` is known.
 */
export function ThemeToggle({
  className,
}: {
  className?: string;
}): React.ReactElement {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="dark:hidden" aria-hidden="true" />
      <MoonIcon className="hidden dark:block" aria-hidden="true" />
      <span className="sr-only">Toggle light and dark theme</span>
    </Button>
  );
}

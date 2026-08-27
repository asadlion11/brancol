"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Class-based theming. `attribute="class"` writes `.dark` onto <html>, which
 * is what globals.css's `@custom-variant dark (&:is(.dark *))` keys off.
 *
 * next-themes injects a blocking inline script that sets the class before
 * first paint, so there is no flash — provided <html> carries
 * `suppressHydrationWarning` (see app/layout.tsx), because the server cannot
 * know which class that script will write.
 *
 * `defaultTheme="system"` + `enableSystem` means we follow the OS until the
 * user says otherwise.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

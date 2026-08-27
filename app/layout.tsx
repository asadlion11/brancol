import type { Metadata } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Brand typeface: display + body.
//
// The CSS variable is named for the family, NOT for its role. globals.css
// maps it onto Tailwind's `--font-sans` inside `@theme inline`. Naming it
// `--font-sans` here instead would make that mapping self-referential
// (`--font-sans: var(--font-sans)`), which only resolves by accident of
// next/font's declaration being unlayered.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Utility only: HEX values, code exports.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "brancol",
  description:
    "Describe your project in plain language and get a harmonious color system back — every color with a semantic role, a human name, and HEX, RGB, HSL and OKLCH values.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning` is required: next-themes' blocking script
    // writes the theme class onto <html> before React hydrates, so the
    // server-rendered markup deliberately differs from the DOM.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <SkipLink />
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";

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

/**
 * Where absolute URLs in the metadata resolve against.
 *
 * Server-only on purpose — it is read while the document is rendered and is
 * never needed in the browser, so it must not carry a `NEXT_PUBLIC_` prefix.
 */
const SITE_URL = process.env.SITE_URL ?? "https://brancol.app";

const DESCRIPTION =
  "Describe your project in plain language and get a harmonious color system back — every color with a semantic role, a human name, and HEX, RGB, HSL and OKLCH values.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Lowercase everywhere, including the tab. `template` covers any future
  // route without letting one of them drop the name.
  title: { default: "brancol", template: "%s — brancol" },
  applicationName: "brancol",
  description: DESCRIPTION,
  keywords: [
    "color palette generator",
    "design tokens",
    "color system",
    "OKLCH",
    "brand colors",
    "WCAG contrast",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "brancol",
    title: "brancol",
    description: DESCRIPTION,
    url: "/",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "brancol",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
  // No `icons` entry: `app/icon.svg` (the band motif) and
  // `app/opengraph-image.tsx` are picked up by Next's file conventions, which
  // also hash them for cache-busting. Declaring them here would override that
  // with an unhashed path. There is no logo file — the wordmark is type only.
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
      <body className="flex h-dvh flex-col overflow-hidden">
        <ThemeProvider>
          <SkipLink />
          <SiteHeader />
          <main
            id="main"
            tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col"
          >
            {children}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

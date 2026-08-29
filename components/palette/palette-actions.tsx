"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CheckIcon, LinkIcon } from "lucide-react";

import { copyText } from "@/lib/toast";
import type { Color } from "@/lib/types";
import { paletteShareUrl } from "@/lib/url";
import { Button } from "@/components/ui/button";

/**
 * The export dialog is the heaviest thing on the page that nobody needs yet:
 * Radix Dialog, Radix Tabs and all four renderers, for a surface that does not
 * exist until a palette does and is not opened until it is clicked. Split out,
 * it stops counting against the first load. Server rendering stays on, so the
 * trigger is in the initial HTML at its final size and the toolbar never
 * reflows once the chunk lands.
 */
const ExportDialog = dynamic(() =>
  import("@/components/palette/export-dialog").then((mod) => mod.ExportDialog),
);

/**
 * What you can do with the whole palette, as opposed to one band: take it out
 * as code, or hand it to someone else.
 *
 * Both live in the footer rule under the rail, in the same micro type as the
 * count and the model line, because neither is the point of the page — the
 * colors are.
 */

/**
 * The share link, and the address bar that now agrees with it.
 *
 * There is no server and no palette id (L8): the link *is* the palette. So the
 * button does two things at once — copies the URL, and rewrites the current
 * one with `replaceState` so what the user sees in the address bar is what
 * they just put on the clipboard. `replaceState` rather than `pushState`:
 * sharing is not navigation, and it must not put a back button in the way.
 */
function ShareButton({
  palette,
  onAnnounce,
}: {
  palette: Color[];
  onAnnounce?: (message: string) => void;
}) {
  const [shared, setShared] = React.useState(false);

  React.useEffect(() => {
    if (!shared) return;
    const timer = window.setTimeout(() => setShared(false), 2000);
    return () => window.clearTimeout(timer);
  }, [shared]);

  const share = () => {
    const url = paletteShareUrl(palette);

    void copyText(url, "share link").then((ok) => {
      if (!ok) return;
      setShared(true);
      onAnnounce?.("Share link copied. It carries the whole palette.");

      try {
        window.history.replaceState(null, "", url);
      } catch {
        // A sandboxed frame refuses history writes. The link is already on
        // the clipboard, which is the part that mattered.
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={share}
      className="uppercase"
    >
      {shared ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
      {shared ? "Link copied" : "Share link"}
    </Button>
  );
}

export function PaletteToolbar({
  palette,
  onAnnounce,
}: {
  palette: Color[];
  onAnnounce?: (message: string) => void;
}) {
  if (palette.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ExportDialog palette={palette} onAnnounce={onAnnounce} />
      <ShareButton palette={palette} onAnnounce={onAnnounce} />
    </div>
  );
}

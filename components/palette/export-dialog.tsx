"use client";

import * as React from "react";
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";

import {
  EXPORT_FORMATS,
  exportFormat,
  type ExportFormatId,
} from "@/lib/export";
import { copyText, toastError } from "@/lib/toast";
import type { Color } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * The export dialog.
 *
 * Four formats, one registry. Every tab, filename, media type and renderer
 * comes out of `EXPORT_FORMATS` — nothing about CSS or Tokens is spelled out
 * here, so a fifth format is one entry in `lib/export/index.ts` and no change
 * at all in this file.
 *
 * Only the visible tab's payload is ever rendered. `format.render` walks the
 * whole palette and builds a string; doing that four times to fill three
 * hidden panels would be work nobody asked for, so the panel is keyed off the
 * controlled tab value and computed once.
 */

/**
 * Hands the file to the browser.
 *
 * Object URL rather than a `data:` URI: a ten-color token file is comfortably
 * past the size where data URIs start being refused, and the blob is revoked
 * on the next frame so nothing is held.
 */
function downloadText(
  filename: string,
  mediaType: string,
  text: string,
): boolean {
  try {
    const blob = new Blob([text], { type: `${mediaType};charset=utf-8` });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = href;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(href), 0);
    return true;
  } catch {
    return false;
  }
}

export function ExportDialog({
  palette,
  onAnnounce,
}: {
  palette: Color[];
  /** Writes the outcome into the page's polite live region. */
  onAnnounce?: (message: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<ExportFormatId>(
    EXPORT_FORMATS[0].id,
  );
  const [copied, setCopied] = React.useState<ExportFormatId | null>(null);

  const format = exportFormat(active);

  // Recomputed only when the tab or the palette changes — never once per
  // format, and never on an unrelated re-render.
  const code = React.useMemo(() => format.render(palette), [format, palette]);

  // The check mark is a confirmation, not a state: it says "that one, just
  // now" and then gets out of the way.
  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void copyText(code, format.label).then((ok) => {
      if (!ok) return;
      setCopied(format.id);
      onAnnounce?.(`Copied the ${format.label} export to the clipboard.`);
    });
  };

  const download = () => {
    if (downloadText(format.filename, format.mediaType, code)) {
      onAnnounce?.(`Downloading ${format.filename}.`);
      return;
    }
    toastError(`Couldn't download ${format.filename}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCopied(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="xs" className="uppercase">
          <DownloadIcon aria-hidden />
          Export tokens
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export tokens</DialogTitle>
          <DialogDescription>
            {palette.length} colors, every role and every value. Copy the block
            or take the file.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={active}
          onValueChange={(value) => {
            setActive(value as ExportFormatId);
            setCopied(null);
          }}
        >
          <TabsList aria-label="Export format">
            {EXPORT_FORMATS.map((entry) => (
              <TabsTrigger key={entry.id} value={entry.id}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* One panel, the live one. The other three exist as triggers only,
              so their payloads are never built. */}
          <TabsContent value={active}>
            <p className="text-label text-muted-foreground">{format.hint}</p>

            <pre
              // Long token lines scroll inside the block; the dialog itself
              // never grows and the page never scrolls sideways.
              className="max-h-[46vh] overflow-auto border border-border bg-muted/40 p-3 type-code text-micro tracking-normal normal-case"
              tabIndex={0}
              aria-label={`${format.label} export`}
            >
              <code>{code}</code>
            </pre>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="type-hex text-micro text-muted-foreground normal-case">
                {format.filename}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copy}
                >
                  {copied === format.id ? (
                    <CheckIcon aria-hidden />
                  ) : (
                    <CopyIcon aria-hidden />
                  )}
                  {copied === format.id ? "Copied" : `Copy ${format.label}`}
                </Button>

                <Button type="button" size="sm" onClick={download}>
                  <DownloadIcon aria-hidden />
                  Download
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

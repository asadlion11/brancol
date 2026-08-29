import { ImageResponse } from "next/og";

/**
 * The social card.
 *
 * Same poster, smaller: a type-only lowercase wordmark on a quiet ground, a
 * hairline, and the band motif running full-bleed across the bottom third —
 * sharp-edged, abutting, no radius and no gap, exactly as the hero renders it.
 * Anyone who has seen a brancol link recognises the app before they read the
 * title, which is the only job a card has.
 *
 * No custom font is loaded: `ImageResponse` ships its own sans, and fetching a
 * webfont here would make the build depend on the network for a picture.
 */

export const alt =
  "brancol — describe your project, get a color system with roles, names and HEX, RGB, HSL and OKLCH values";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The band motif, in the brand's own colors. */
const BANDS = [
  "#6C4CF1",
  "#8E6BF4",
  "#211A45",
  "#52E3B6",
  "#C9C4E8",
  "#F8F9FC",
] as const;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#F8F9FC",
        color: "#211A45",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "72px 80px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 46,
            fontWeight: 600,
            letterSpacing: "-0.03em",
          }}
        >
          brancol
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 76,
            lineHeight: 1.05,
            fontWeight: 600,
            letterSpacing: "-0.035em",
            maxWidth: 900,
          }}
        >
          Describe your project. Get colors that work together.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 26,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "#676776",
          }}
        >
          Role · Name · HEX · RGB · HSL · OKLCH
        </div>
      </div>

      {/* The rail. Bands are equal flex children, so they fill the width
            exactly — the poster is always complete. */}
      <div style={{ display: "flex", width: "100%", height: 188 }}>
        {BANDS.map((hex) => (
          <div
            key={hex}
            style={{ display: "flex", flex: 1, backgroundColor: hex }}
          />
        ))}
      </div>
    </div>,
    size,
  );
}

/**
 * Export tests — the outputs are *parsed*, not string-matched.
 *
 * The promise this product makes is "paste it into your repo and it works".
 * A test that asserts `output.includes("--color-primary")` does not check
 * that promise at all: a file can contain that substring and still be
 * unbalanced CSS or unparseable JS. So every format here is handed to a real
 * parser — postcss for the two CSS payloads, `JSON.parse` for the two JSON
 * ones, and the JS engine itself for the Tailwind v3 config — and the values
 * are read back out of the parse tree.
 */

import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

import { exportCss } from "../export/css";
import { exportJson, toJsonExport } from "../export/json";
import {
  exportTailwind,
  tailwindColors,
  tailwindV3Config,
  tailwindV4Theme,
  TAILWIND_V3_MARKER,
  TAILWIND_V4_MARKER,
} from "../export/tailwind";
import { exportTokens, toTokenDocument } from "../export/tokens";
import { EXPORT_FORMATS, exportFormat } from "../export";
import { SAMPLE_PALETTE, TEN_COLOR_PALETTE } from "./fixtures";

const HEX = /^#[0-9A-F]{6}$/;

/** Every custom property declared directly inside a rule. */
function customProperties(rule: Rule): Record<string, string> {
  const props: Record<string, string> = {};
  rule.walkDecls((decl: Declaration) => {
    if (decl.prop.startsWith("--")) props[decl.prop] = decl.value;
  });
  return props;
}

/** The first rule matching `selector`, anywhere in the sheet. */
function ruleFor(css: string, selector: string): Rule | undefined {
  let found: Rule | undefined;
  postcss.parse(css).walkRules((rule) => {
    if (!found && rule.selector === selector) found = rule;
  });
  return found;
}

describe("CSS export", () => {
  const css = exportCss(SAMPLE_PALETTE);

  it("parses as CSS with no edits", () => {
    expect(() => postcss.parse(css)).not.toThrow();
  });

  it("declares one role-named custom property per color, with the right hex", () => {
    const root = ruleFor(css, ":root");
    expect(root).toBeDefined();

    const props = customProperties(root!);
    expect(Object.keys(props)).toHaveLength(SAMPLE_PALETTE.length);

    for (const color of SAMPLE_PALETTE) {
      expect(props[`--color-${color.role}`]).toBe(color.hex);
    }
  });

  it("emits a prefers-color-scheme block whose values are derived, not repeated", () => {
    const root = customProperties(ruleFor(css, ":root")!);

    // The dark declarations live inside the at-rule, so collect them from it.
    const dark: Record<string, string> = {};
    let sawMediaQuery = false;

    postcss.parse(css).walkAtRules("media", (atRule) => {
      if (atRule.params !== "(prefers-color-scheme: dark)") return;
      sawMediaQuery = true;
      atRule.walkRules(":root", (rule) => {
        Object.assign(dark, customProperties(rule));
      });
    });

    expect(sawMediaQuery).toBe(true);

    expect(Object.keys(dark)).toEqual(Object.keys(root));
    for (const prop of Object.keys(root)) {
      expect(dark[prop]).toMatch(HEX);
      expect(dark[prop]).not.toBe(root[prop]);
    }
  });

  it("honours the class-based and light-only dark modes", () => {
    const classed = exportCss(SAMPLE_PALETTE, { darkMode: "class" });
    expect(() => postcss.parse(classed)).not.toThrow();
    expect(ruleFor(classed, ".dark")).toBeDefined();

    const lightOnly = exportCss(SAMPLE_PALETTE, { darkMode: "none" });
    expect(() => postcss.parse(lightOnly)).not.toThrow();
    expect(ruleFor(lightOnly, ".dark")).toBeUndefined();
    expect(lightOnly).not.toContain("prefers-color-scheme");
  });

  it("honours a custom property prefix", () => {
    const prefixed = exportCss(SAMPLE_PALETTE, { prefix: "brand" });
    const props = customProperties(ruleFor(prefixed, ":root")!);
    expect(props["--brand-primary"]).toBe("#7FA88E");
  });

  it("cannot be broken out of by a color name that closes the comment", () => {
    const hostile = [
      { ...SAMPLE_PALETTE[0], name: "Sage */ ; color: red; /*" },
      SAMPLE_PALETTE[1],
    ];
    const output = exportCss(hostile);

    expect(() => postcss.parse(output)).not.toThrow();
    const props = customProperties(ruleFor(output, ":root")!);
    expect(props["--color-primary"]).toBe("#7FA88E");
    expect(props.color).toBeUndefined();
  });
});

describe("JSON export", () => {
  it("round-trips the palette exactly", () => {
    const parsed = JSON.parse(exportJson(SAMPLE_PALETTE));
    expect(parsed.colors).toEqual(SAMPLE_PALETTE);
  });

  it("carries all four formats plus role and name on every color", () => {
    const parsed = JSON.parse(exportJson(TEN_COLOR_PALETTE));

    expect(parsed.version).toBe(1);
    expect(parsed.colors).toHaveLength(10);

    for (const color of parsed.colors) {
      expect(Object.keys(color).sort()).toEqual([
        "hex",
        "hsl",
        "locked",
        "name",
        "oklch",
        "rgb",
        "role",
      ]);
      expect(color.hex).toMatch(HEX);
      expect(color.rgb).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
      expect(color.hsl).toMatch(/^hsl\(\d+,\d+%,\d+%\)$/);
      expect(color.oklch).toMatch(/^oklch\([\d.]+ [\d.]+ \d+\)$/);
      expect(typeof color.name).toBe("string");
    }
  });

  it("preserves lock state", () => {
    const parsed = toJsonExport(TEN_COLOR_PALETTE);
    expect(parsed.colors.filter((color) => color.locked)).toHaveLength(1);
  });

  it("is byte-stable across calls", () => {
    expect(exportJson(SAMPLE_PALETTE)).toBe(exportJson(SAMPLE_PALETTE));
  });
});

describe("Tailwind export", () => {
  const output = exportTailwind(SAMPLE_PALETTE);

  it("labels both halves", () => {
    expect(output).toContain(TAILWIND_V4_MARKER);
    expect(output).toContain(TAILWIND_V3_MARKER);
  });

  it("emits a v4 @theme block that is valid CSS with the right values", () => {
    const theme = tailwindV4Theme(SAMPLE_PALETTE);

    const root = postcss.parse(theme);
    const names: string[] = [];
    const props: Record<string, string> = {};

    root.walkAtRules((atRule) => {
      names.push(atRule.name);
      atRule.walkDecls((decl) => {
        props[decl.prop] = decl.value;
      });
    });

    expect(names).toEqual(["theme"]);

    for (const color of SAMPLE_PALETTE) {
      expect(props[`--color-${color.role}`]).toBe(color.hex);
    }
  });

  it("emits a v3 colors object that is JSON-parseable", () => {
    const config = tailwindV3Config(SAMPLE_PALETTE);
    const body = config.slice(config.indexOf("colors: {") + "colors: ".length);
    const closing = body.indexOf("}");
    const colors = JSON.parse(body.slice(0, closing + 1));

    expect(colors).toEqual(tailwindColors(SAMPLE_PALETTE));
    expect(colors.primary).toBe("#7FA88E");
    expect(colors.background).toBe("#F6F2EB");
  });

  it("emits a v3 config that the JS engine actually accepts", () => {
    const config = tailwindV3Config(TEN_COLOR_PALETTE);

    const mod: { exports: Record<string, unknown> } = { exports: {} };
    // If the snippet were not valid JS this constructor throws — which is the
    // whole assertion. Nothing user-supplied reaches it; the input is a
    // palette we built.
    new Function("module", "exports", config)(mod, mod.exports);

    const theme = mod.exports.theme as {
      extend: { colors: Record<string, string> };
    };
    expect(theme.extend.colors).toEqual(tailwindColors(TEN_COLOR_PALETTE));
    expect(Object.keys(theme.extend.colors)).toHaveLength(10);
  });

  it("keeps both halves parseable when pulled out of the combined output", () => {
    const v4 = output.slice(
      output.indexOf("@theme"),
      output.indexOf(TAILWIND_V3_MARKER),
    );
    expect(() => postcss.parse(v4)).not.toThrow();

    const v3 = output.slice(output.indexOf("/** @type"));
    const mod: { exports: Record<string, unknown> } = { exports: {} };
    expect(() =>
      new Function("module", "exports", v3)(mod, mod.exports),
    ).not.toThrow();
  });
});

describe("design token export", () => {
  it("is valid JSON in the W3C shape", () => {
    const document = JSON.parse(exportTokens(SAMPLE_PALETTE));

    expect(Object.keys(document)).toEqual(["color"]);

    for (const color of SAMPLE_PALETTE) {
      const token = document.color[color.role];
      expect(token).toBeDefined();
      expect(token.$type).toBe("color");
      expect(token.$value).toBe(color.hex);
      expect(token.$description).toBe(color.name);
    }
  });

  it("puts $type on every leaf, not only on the group", () => {
    const document = toTokenDocument(TEN_COLOR_PALETTE, { includeDark: true });

    const groups = [document.color, document["color-dark"]!];
    for (const group of groups) {
      expect(Object.keys(group)).toHaveLength(10);
      for (const token of Object.values(group)) {
        expect(token.$type).toBe("color");
        expect(token.$value).toMatch(HEX);
      }
    }
  });

  it("derives the dark group rather than copying the light one", () => {
    const document = toTokenDocument(SAMPLE_PALETTE, { includeDark: true });
    const dark = document["color-dark"]!;

    for (const color of SAMPLE_PALETTE) {
      expect(dark[color.role].$value).not.toBe(color.hex);
    }
  });
});

describe("export registry", () => {
  it("renders every registered format without throwing", () => {
    for (const format of EXPORT_FORMATS) {
      const output = format.render(SAMPLE_PALETTE);
      expect(output.length).toBeGreaterThan(0);
      expect(format.filename).toMatch(/^brancol-/);
    }
  });

  it("looks a format up by id and falls back rather than crashing", () => {
    expect(exportFormat("tokens").id).toBe("tokens");
    // A stale id from a persisted tab choice must not take the dialog down.
    expect(exportFormat("nope" as never).id).toBe("css");
  });
});

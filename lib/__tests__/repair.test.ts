import { describe, expect, it } from "vitest";

import {
  extractPalette,
  jsonSlices,
  parseLooseJson,
  repairJsonText,
  stripCodeFences,
} from "../ai/repair";

/**
 * These fixtures are the shapes free models actually produce. This suite is the
 * guard that malformed AI output never reaches the UI: anything unrepairable
 * must come back as `null` so the adapter fails over instead of rendering junk.
 */

const CLEAN = `{"colors":[{"role":"primary","name":"Ocean Blue","hex":"#1769AA"},{"role":"background","name":"Sea Foam","hex":"#F2F7F5"}]}`;

describe("stripCodeFences", () => {
  it("unwraps a ```json fence", () => {
    expect(stripCodeFences("```json\n" + CLEAN + "\n```")).toBe(CLEAN);
  });

  it("unwraps a fence the model never closed", () => {
    expect(stripCodeFences("```json\n" + CLEAN)).toBe(CLEAN);
  });

  it("leaves unfenced text alone", () => {
    expect(stripCodeFences(CLEAN)).toBe(CLEAN);
  });
});

describe("jsonSlices", () => {
  it("finds the object inside surrounding prose", () => {
    const slices = jsonSlices(
      `Sure! Here you go: ${CLEAN} Let me know if you want tweaks.`,
    );
    expect(slices[0]).toBe(CLEAN);
  });

  it("ignores braces that live inside strings", () => {
    const slices = jsonSlices(`{"name":"a } b","hex":"#000000"}`);
    expect(slices[0]).toBe(`{"name":"a } b","hex":"#000000"}`);
  });
});

describe("repairJsonText", () => {
  it("drops trailing commas", () => {
    expect(repairJsonText(`{"a":1,}`)).toBe(`{"a":1}`);
  });

  it("converts single-quoted strings", () => {
    expect(JSON.parse(repairJsonText(`{'role':'primary'}`))).toEqual({
      role: "primary",
    });
  });

  it("quotes bare keys", () => {
    expect(JSON.parse(repairJsonText(`{role:"primary"}`))).toEqual({
      role: "primary",
    });
  });
});

describe("parseLooseJson", () => {
  it("parses well-formed JSON untouched", () => {
    expect(parseLooseJson(CLEAN)).toEqual(JSON.parse(CLEAN));
  });

  it("returns null for pure garbage", () => {
    expect(parseLooseJson("I'm sorry, I can't help with that.")).toBeNull();
    expect(parseLooseJson("")).toBeNull();
  });
});

describe("extractPalette", () => {
  it("handles clean JSON", () => {
    const colors = extractPalette(CLEAN);
    expect(colors).toHaveLength(2);
    expect(colors?.[0]).toEqual({
      role: "primary",
      name: "Ocean Blue",
      hex: "#1769AA",
    });
  });

  it("handles fenced JSON", () => {
    const colors = extractPalette("```json\n" + CLEAN + "\n```");
    expect(colors).toHaveLength(2);
  });

  it("handles prose before and after the JSON", () => {
    const raw = `Here's a calm palette for your wellness app:\n\n${CLEAN}\n\nI kept the contrast gentle.`;
    expect(extractPalette(raw)).toHaveLength(2);
  });

  it("handles a trailing comma", () => {
    const raw = `{"colors":[{"role":"primary","name":"Ocean Blue","hex":"#1769AA"},]}`;
    expect(extractPalette(raw)).toHaveLength(1);
  });

  it("expands 3-digit hex to 6-digit", () => {
    const raw = `{"colors":[{"role":"primary","name":"Ocean Blue","hex":"#1AF"}]}`;
    expect(extractPalette(raw)?.[0].hex).toBe("#11AAFF");
  });

  it("accepts a hex missing its leading #", () => {
    const raw = `{"colors":[{"role":"primary","name":"Ocean Blue","hex":"1769aa"}]}`;
    expect(extractPalette(raw)?.[0].hex).toBe("#1769AA");
  });

  it("drops extra unexpected keys and the model's own color math", () => {
    const raw = `{"colors":[{"role":"primary","name":"Ocean Blue","hex":"#1769AA","rgb":"rgb(1,2,3)","usage":"buttons","contrast":4.5}]}`;
    const colors = extractPalette(raw);
    expect(colors?.[0]).toEqual({
      role: "primary",
      name: "Ocean Blue",
      hex: "#1769AA",
    });
    expect(Object.keys(colors?.[0] ?? {})).not.toContain("rgb");
  });

  it("handles single quotes and unquoted keys together", () => {
    const raw = `{colors: [{role: 'primary', name: 'Ocean Blue', hex: '#1769AA'}]}`;
    expect(extractPalette(raw)?.[0].name).toBe("Ocean Blue");
  });

  it("handles a bare top-level array", () => {
    const raw = `[{"role":"primary","name":"Ocean Blue","hex":"#1769AA"}]`;
    expect(extractPalette(raw)).toHaveLength(1);
  });

  it("handles an envelope the model renamed", () => {
    const raw = `{"palette":[{"role":"primary","name":"Ocean Blue","hex":"#1769AA"}]}`;
    expect(extractPalette(raw)).toHaveLength(1);
  });

  it("handles a role-keyed object map", () => {
    const raw = `{"primary":"#1769AA","background":"#F2F7F5"}`;
    const colors = extractPalette(raw);
    expect(colors).toHaveLength(2);
    expect(colors?.[0].role).toBe("primary");
  });

  it("tolerates a color with no role at all", () => {
    const raw = `{"colors":[{"name":"Ocean Blue","hex":"#1769AA"}]}`;
    expect(extractPalette(raw)?.[0].role).toBeUndefined();
  });

  it("skips entries whose hex is unusable but keeps the rest", () => {
    const raw = `{"colors":[{"role":"primary","hex":"not a color"},{"role":"accent","hex":"#123456"}]}`;
    const colors = extractPalette(raw);
    expect(colors).toHaveLength(1);
    expect(colors?.[0].hex).toBe("#123456");
  });

  it("returns null for pure garbage so the adapter fails over", () => {
    expect(
      extractPalette("As an AI language model, I cannot pick colors."),
    ).toBeNull();
    expect(extractPalette("")).toBeNull();
    expect(extractPalette("{{{{")).toBeNull();
  });

  it("returns null when the JSON parses but holds no colors", () => {
    expect(extractPalette(`{"colors":[]}`)).toBeNull();
    expect(extractPalette(`{"message":"here you go"}`)).toBeNull();
  });
});

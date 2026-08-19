import { describe, expect, it } from "vitest";

import {
  dxfCodePageToTextDecoderLabel,
  parseDxfAsciiPairsFromBytes,
  readDxfHeaderCodePageFromPairs,
} from "./stage-design-dxf-codepage";
import { importDxfEntities } from "./stage-design-dxf-import";

function minimalDxfWithHeader(headerBody: string, entitiesBody: string): Uint8Array {
  const ascii = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    headerBody.trim(),
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    entitiesBody.trim(),
    "0",
    "ENDSEC",
    "0",
    "EOF",
    "",
  ].join("\r\n");
  return new TextEncoder().encode(ascii);
}

describe("dxfCodePageToTextDecoderLabel", () => {
  it("maps ANSI_1252 to windows-1252", () => {
    expect(dxfCodePageToTextDecoderLabel("ANSI_1252")).toBe("windows-1252");
    expect(dxfCodePageToTextDecoderLabel("ANSI_1250")).toBe("windows-1250");
    expect(dxfCodePageToTextDecoderLabel("UTF-8")).toBe("utf-8");
  });
});

describe("parseDxfAsciiPairsFromBytes", () => {
  it("reads $DWGCODEPAGE from header pairs", () => {
    const bytes = minimalDxfWithHeader(
      `
9
$DWGCODEPAGE
3
ANSI_1252
`,
      "0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n",
    );
    const pairs = parseDxfAsciiPairsFromBytes(bytes);
    expect(readDxfHeaderCodePageFromPairs(pairs)).toBe("ANSI_1252");
  });

  it("decodes Windows-1252 TEXT label bytes", () => {
    const label = `Caf${String.fromCharCode(0xe9)}`;
    const body = ["0", "TEXT", "10", "1", "20", "2", "1", label].join("\r\n");
    const ascii = [
      "0",
      "SECTION",
      "2",
      "HEADER",
      "9",
      "$DWGCODEPAGE",
      "3",
      "ANSI_1252",
      "0",
      "ENDSEC",
      "0",
      "SECTION",
      "2",
      "ENTITIES",
      body,
      "0",
      "ENDSEC",
      "0",
      "EOF",
      "",
    ].join("\r\n");
    const bytes = new Uint8Array(ascii.length);
    for (let i = 0; i < ascii.length; i++) bytes[i] = ascii.charCodeAt(i) & 0xff;

    const r = importDxfEntities(bytes, { maxShapes: 5 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.text).toBe(1);
    expect(r.shapes[0]).toMatchObject({ kind: "TEXT", label: "Café" });
  });
});

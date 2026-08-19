import { describe, expect, it } from "vitest";

import {
  DXF_BINARY_SENTINEL,
  encodeDxfBinaryPairs,
  isBinaryDxfBytes,
  parseDxfBinaryPairs,
  parseDxfFileToPairs,
} from "./stage-design-dxf-binary";
import { importDxfEntities, parseDxfAsciiPairs } from "./stage-design-dxf-import";

function minimalDxfEntities(body: string): string {
  return [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    body.trim(),
    "0",
    "ENDSEC",
    "0",
    "EOF",
    "",
  ].join("\r\n");
}

describe("parseDxfBinaryPairs", () => {
  it("round-trips a minimal ASCII DXF through binary encoding", () => {
    const ascii = minimalDxfEntities(`
0
LINE
10
1
20
2
11
9
21
8
`);
    const pairs = parseDxfAsciiPairs(ascii);
    const binary = encodeDxfBinaryPairs(pairs);
    expect(isBinaryDxfBytes(binary)).toBe(true);
    const decoded = parseDxfBinaryPairs(binary);
    expect(decoded.some((p) => p.code === 0 && p.value === "LINE")).toBe(true);
    expect(decoded.find((p) => p.code === 10)?.value).toBe("1");
    expect(decoded.find((p) => p.code === 21)?.value).toBe("8");
  });

  it("imports binary DXF LINE entities into diagram shapes", () => {
    const ascii = minimalDxfEntities(`
0
LINE
10
3
20
4
11
13
21
14
`);
    const binary = encodeDxfBinaryPairs(parseDxfAsciiPairs(ascii));
    const r = importDxfEntities(binary, { maxShapes: 20 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.line).toBe(1);
    expect(r.shapes[0]).toMatchObject({ kind: "LINE", x: 3, y: 4, x2: 13, y2: 14 });
  });

  it("detects binary sentinel length", () => {
    expect(DXF_BINARY_SENTINEL.length).toBe(22);
  });
});

describe("parseDxfFileToPairs", () => {
  it("parses ASCII via string input", () => {
    const r = parseDxfFileToPairs(minimalDxfEntities("0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.format).toBe("ascii");
  });

  it("parses binary via Uint8Array input", () => {
    const binary = encodeDxfBinaryPairs(parseDxfAsciiPairs(minimalDxfEntities("0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n")));
    const r = parseDxfFileToPairs(binary);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.format).toBe("binary");
  });
});

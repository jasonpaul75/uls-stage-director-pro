import { describe, expect, it } from "vitest";

import {
  detectDxfBinaryGroupCodeWidth,
  encodeDxfBinaryPairsPreR14,
  isSaneDxfPairStream,
  parseDxfBinaryPairsPreR14,
} from "./stage-design-dxf-binary-prer14";
import { encodeDxfBinaryPairs, parseDxfBinaryPairs, parseDxfFileToPairs } from "./stage-design-dxf-binary";
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

describe("parseDxfBinaryPairsPreR14", () => {
  it("round-trips through pre-R14 binary encoding", () => {
    const ascii = minimalDxfEntities(`
0
LINE
10
2
20
3
11
8
21
9
`);
    const pairs = parseDxfAsciiPairs(ascii);
    const binary = encodeDxfBinaryPairsPreR14(pairs);
    expect(detectDxfBinaryGroupCodeWidth(binary)).toBe("1");
    const decoded = parseDxfBinaryPairsPreR14(binary);
    expect(isSaneDxfPairStream(decoded)).toBe(true);
    expect(decoded.find((p) => p.code === 10)?.value).toBe("2");
    expect(decoded.find((p) => p.code === 21)?.value).toBe("9");
  });

  it("parseDxfBinaryPairs auto-selects pre-R14 width", () => {
    const binary = encodeDxfBinaryPairsPreR14(parseDxfAsciiPairs(minimalDxfEntities("0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n")));
    const decoded = parseDxfBinaryPairs(binary);
    expect(decoded.some((p) => p.code === 0 && p.value === "LINE")).toBe(true);
  });

  it("imports pre-R14 binary LINE entities", () => {
    const binary = encodeDxfBinaryPairsPreR14(
      parseDxfAsciiPairs(
        minimalDxfEntities(`
0
LINE
10
1
20
2
11
5
21
6
`),
      ),
    );
    const r = importDxfEntities(binary, { maxShapes: 10 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.line).toBe(1);
    expect(r.shapes[0]).toMatchObject({ kind: "LINE", x: 1, y: 2, x2: 5, y2: 6 });
  });

  it("still parses R14+ modular-string binary", () => {
    const binary = encodeDxfBinaryPairs(parseDxfAsciiPairs(minimalDxfEntities("0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n")));
    expect(detectDxfBinaryGroupCodeWidth(binary)).toBe("2");
    const r = parseDxfFileToPairs(binary);
    expect(r.ok).toBe(true);
  });
});

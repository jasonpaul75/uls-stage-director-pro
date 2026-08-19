import { describe, expect, it } from "vitest";

import { buildStageDesignDxf } from "./stage-design-dxf-export";
import { importMinimalAsciiDxfEntities } from "./stage-design-dxf-import";
import {
  MTEXT_DIAGRAM_COLUMN_BREAK,
  decodeMtextStackedFractions,
  decodeMtextUnicodeEscapes,
  encodeMinimalMtextForExport,
  formatDiagramTextLabelForDisplay,
  stripMinimalMtextMarkup,
} from "./stage-design-dxf-mtext";
import { StageDesignUnit } from "@prisma/client";

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

function minimalCanvas(overrides: { shapes?: unknown[] } = {}) {
  return {
    version: 1 as const,
    footprint: { width: 40, depth: 30 },
    plotMargins: { top: 2, right: 2, bottom: 2, left: 2 },
    shapes: overrides.shapes ?? [],
    placements: [],
  };
}

describe("stripMinimalMtextMarkup", () => {
  it("preserves paragraphs as newlines and strips fonts/braces", () => {
    expect(stripMinimalMtextMarkup(`{\\fArial|b0|i0;First\\PSecond}`)).toBe("First\nSecond");
  });

  it("trims outer whitespace but keeps logical lines", () => {
    expect(stripMinimalMtextMarkup("  A  \\P  B  ")).toBe("A\nB");
  });

  it("maps literal \\t escapes to TAB characters", () => {
    expect(stripMinimalMtextMarkup("One\\tTwo\\PMore")).toBe("One\tTwo\nMore");
  });

  it("strips paragraph layout directives before paragraph breaks", () => {
    expect(stripMinimalMtextMarkup("\\pxqc188,l1440,t1440,b288;Left\\PRight")).toBe("Left\nRight");
  });

  it("unwraps AutoCAD-style fields into quoted summaries (%22 literals)", () => {
    expect(stripMinimalMtextMarkup(`Label %<%22North Wing%22 \\AcDummy dummy>% end`)).toBe("Label North Wing end");
  });

  it("unwraps fields using ASCII quotes inside %<…>%", () => {
    expect(stripMinimalMtextMarkup(`Sheet %<\\AcExpr Format(%22A1%22)>% here`)).toBe("Sheet A1 here");
  });

  it("decodes stacked fractions with # into fraction slash", () => {
    expect(stripMinimalMtextMarkup("Slope \\S1#4; rise")).toBe("Slope 1⁄4 rise");
  });

  it("decodes stacked fractions with ^ into slash", () => {
    expect(stripMinimalMtextMarkup("Offset \\S3^8; in")).toBe("Offset 3/8 in");
  });

  it("maps column breaks (\\N) to internal column separator", () => {
    expect(stripMinimalMtextMarkup("Left\\NRight")).toBe(`Left${MTEXT_DIAGRAM_COLUMN_BREAK}Right`);
  });

  it("strips multi-column composer directives and keeps column-separated cells", () => {
    expect(stripMinimalMtextMarkup("\\column{2}\\fArial;Col1\\NCol2")).toBe(
      `Col1${MTEXT_DIAGRAM_COLUMN_BREAK}Col2`,
    );
  });

  it("decodes Unicode escapes", () => {
    expect(stripMinimalMtextMarkup("45\\U+00B0")).toBe("45°");
  });

  it("summarizes sheet-set property fields", () => {
    expect(stripMinimalMtextMarkup(`Title %<\\AcVar Property(%22Sheet Number%22)>%`)).toBe("Title Sheet Number");
  });

  it("summarizes AcSheetSet quoted properties", () => {
    expect(stripMinimalMtextMarkup(`%<\\AcSheetSet %22View Title%22>%`)).toBe("View Title");
  });

  it("strips underline/overline toggles", () => {
    expect(stripMinimalMtextMarkup("\\LUnder\\l plain")).toBe("Under plain");
  });
});

describe("encodeMinimalMtextForExport", () => {
  it("encodes paragraph newlines as \\P", () => {
    expect(encodeMinimalMtextForExport("Line1\nLine2")).toBe("Line1\\PLine2");
  });

  it("encodes tabs and multi-column rows with \\column and \\N", () => {
    expect(encodeMinimalMtextForExport(`North${MTEXT_DIAGRAM_COLUMN_BREAK}South`)).toBe(
      "\\column{2}North\\NSouth",
    );
  });

  it("encodes multi-row tables with \\P between rows and \\N between columns", () => {
    expect(
      encodeMinimalMtextForExport(`A${MTEXT_DIAGRAM_COLUMN_BREAK}B\nC${MTEXT_DIAGRAM_COLUMN_BREAK}D`),
    ).toBe("\\column{2}A\\NB\\PC\\ND");
  });
});

describe("formatDiagramTextLabelForDisplay", () => {
  it("maps column breaks to tabs for readable titles", () => {
    expect(formatDiagramTextLabelForDisplay(`North${MTEXT_DIAGRAM_COLUMN_BREAK}South`)).toBe("North\tSouth");
  });
});

describe("importMinimalAsciiDxfEntities MTEXT richness", () => {
  it("imports stacked-fraction MTEXT as readable TEXT label", () => {
    const src = minimalDxfEntities(`
0
MTEXT
10
2
20
3
40
1
50
0
1
Rise \\S1#4; per foot
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.shapes[0] as { label?: string }).label).toBe("Rise 1⁄4 per foot");
  });

  it("imports multi-column MTEXT with column breaks as internal column separator", () => {
    const src = minimalDxfEntities(`
0
MTEXT
10
0
20
0
40
1
50
0
1
\\column{2}North\\NSouth
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.shapes[0] as { label?: string }).label).toBe(`North${MTEXT_DIAGRAM_COLUMN_BREAK}South`);
  });

  it("round-trips multi-column MTEXT through DXF export", () => {
    const label = `North${MTEXT_DIAGRAM_COLUMN_BREAK}South`;
    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        shapes: [{ id: "t1", kind: "TEXT", x: 1, y: 2, rotationDeg: 0, label }],
      }),
    });
    expect(dxf).toContain("MTEXT");
    expect(dxf).toContain("\\column{2}");
    expect(dxf).toContain("\\N");
    const r = importMinimalAsciiDxfEntities(dxf, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const imported = r.shapes.find((s) => s.kind === "TEXT");
    expect(imported?.label).toBe(label);
  });
});

describe("decodeMtextStackedFractions", () => {
  it("handles multiple stacked segments", () => {
    expect(decodeMtextStackedFractions("\\S1#2; and \\S3^4;")).toBe("1⁄2 and 3/4");
  });
});

describe("decodeMtextUnicodeEscapes", () => {
  it("leaves non-escape text unchanged", () => {
    expect(decodeMtextUnicodeEscapes("plain")).toBe("plain");
  });
});

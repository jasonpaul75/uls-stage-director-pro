import { afterEach, describe, expect, it, vi } from "vitest";

import { STAGE_SVG_VIEW_H, STAGE_SVG_VIEW_W } from "./stage-design-svg-layout";
import {
  applyPresentationDeckMarkersForExport,
  diagramExportPngPixelSize,
  diagramPdfLetterLandscapeEmbedLayout,
  downgradeSelectionAppearanceForDiagramExport,
  sanitizeDiagramSvgFilenameSlug,
  svgDiagramSerializedForExport,
  triggerPdfDiagramDownload,
  triggerPngDiagramDownload,
} from "./stage-design-svg-export";

describe("svgDiagramSerializedForExport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forces full-stage viewBox on the export clone (authoring viewport zoom ignored)", () => {
    const cloneAttrs: Record<string, string> = {
      viewBox: "120 130 180 170",
    };

    vi.stubGlobal(
      "XMLSerializer",
      class {
        serializeToString(): string {
          return "<svg />";
        }
      },
    );

    const mockClone = {
      querySelectorAll: () => [],
      getAttribute: (name: string) => cloneAttrs[name] ?? null,
      setAttribute(name: string, value: string) {
        cloneAttrs[name] = value;
      },
    };

    const root = {
      cloneNode: () => mockClone,
    } as unknown as SVGSVGElement;

    svgDiagramSerializedForExport(root);

    expect(cloneAttrs.viewBox).toBe(`0 0 ${STAGE_SVG_VIEW_W} ${STAGE_SVG_VIEW_H}`);
  });
});

describe("triggerPngDiagramDownload", () => {
  it("returns false when raster cannot run (non-browser)", async () => {
    await expect(
      triggerPngDiagramDownload("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "t.png"),
    ).resolves.toBe(false);
  });
});

describe("triggerPdfDiagramDownload", () => {
  it("returns false when raster cannot run (non-browser)", async () => {
    await expect(
      triggerPdfDiagramDownload("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "t.pdf"),
    ).resolves.toBe(false);
  });
});

describe("diagramPdfLetterLandscapeEmbedLayout", () => {
  it("centers diagram bitmap on landscape letter with preserved aspect", () => {
    const lay = diagramPdfLetterLandscapeEmbedLayout(1080, 600);
    expect(Math.round(lay.drawW)).toBe(792);
    expect(Math.round(lay.drawH)).toBe(440);
    expect(lay.dx).toBeCloseTo(0, 5);
    expect(lay.dyFromTop).toBeCloseTo((612 - lay.drawH) / 2, 5);
  });
});

describe("diagramExportPngPixelSize", () => {
  it("matches stage viewBox aspect at default width", () => {
    const { w, h } = diagramExportPngPixelSize(1080);
    expect(w).toBe(1080);
    expect(h).toBe(Math.round((1080 * STAGE_SVG_VIEW_H) / STAGE_SVG_VIEW_W));
  });

  it("clamps width", () => {
    expect(diagramExportPngPixelSize(10).w).toBe(64);
    expect(diagramExportPngPixelSize(99999).w).toBe(8192);
  });
});

describe("sanitizeDiagramSvgFilenameSlug", () => {
  it("trims junk and clamps length", () => {
    expect(sanitizeDiagramSvgFilenameSlug("  Proj 123 / Beta  ")).toBe("Proj-123-Beta");
    expect(sanitizeDiagramSvgFilenameSlug("abc".repeat(40)).length).toBe(80);
  });

  it("falls back when empty after sanitize", () => {
    expect(sanitizeDiagramSvgFilenameSlug("   ")).toBe("stage-diagram");
    expect(sanitizeDiagramSvgFilenameSlug("???")).toBe("stage-diagram");
  });

  it("allows alnum underscore dot hyphen", () => {
    expect(sanitizeDiagramSvgFilenameSlug("cmj_Project-001.v2")).toBe("cmj_Project-001.v2");
  });
});

function fakeSvgElement(tag: string): Element {
  const attrs: Record<string, string> = {};
  return {
    tagName: tag,
    getAttribute: (name: string) => attrs[name] ?? null,
    setAttribute: (name: string, value: string) => {
      attrs[name] = value;
    },
    removeAttribute: (name: string) => {
      delete attrs[name];
    },
  } as unknown as Element;
}

describe("applyPresentationDeckMarkersForExport", () => {
  it("rewrites deck fill/stroke and strips markers", () => {
    const p = fakeSvgElement("polygon");
    const presFill = `rgba(251,191,36,${0.055 + 1 * 0.012})`;
    p.setAttribute("data-ulsd-presentation-deck-fill", presFill);
    p.setAttribute("data-ulsd-presentation-deck-stroke", "rgba(251,191,36,0.4)");
    p.setAttribute("fill", "rgba(251,191,36,99)");
    p.setAttribute("stroke", "rgba(96,165,250,0.92)");
    p.setAttribute("stroke-width", "3");
    expect(applyPresentationDeckMarkersForExport(p)).toBe(true);
    expect(p.getAttribute("fill")).toBe(presFill);
    expect(p.getAttribute("stroke")).toBe("rgba(251,191,36,0.4)");
    expect(p.getAttribute("stroke-width")).toBe("2");
    expect(p.getAttribute("data-ulsd-presentation-deck-fill")).toBeNull();
    expect(p.getAttribute("data-ulsd-presentation-deck-stroke")).toBeNull();
  });

  it("ignores non-polygons", () => {
    const r = fakeSvgElement("rect");
    r.setAttribute("data-ulsd-presentation-deck-fill", "rgba(1,2,3,0.5)");
    expect(applyPresentationDeckMarkersForExport(r)).toBe(false);
  });
});

describe("downgradeSelectionAppearanceForDiagramExport", () => {
  it("downgrades shape selection stroke on lines and rects", () => {
    const line = fakeSvgElement("line");
    line.setAttribute("stroke", "rgba(96,165,250,0.95)");
    line.setAttribute("stroke-width", "2.5");
    expect(downgradeSelectionAppearanceForDiagramExport(line)).toBe(true);
    expect(line.getAttribute("stroke")).toBe("rgba(244,244,245,0.45)");
    expect(line.getAttribute("stroke-width")).toBe("1.75");

    const rect = fakeSvgElement("rect");
    rect.setAttribute("stroke", "rgba(96,165,250,0.95)");
    rect.setAttribute("stroke-width", "2");
    expect(downgradeSelectionAppearanceForDiagramExport(rect)).toBe(true);
    expect(rect.getAttribute("stroke-width")).toBe("1.25");
  });

  it("no-op when stroke is unrelated", () => {
    const rect = fakeSvgElement("rect");
    rect.setAttribute("stroke", "rgba(59,130,246,0.95)");
    rect.setAttribute("stroke-width", "1.25");
    expect(downgradeSelectionAppearanceForDiagramExport(rect)).toBe(false);
  });
});

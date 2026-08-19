import { describe, expect, it } from "vitest";

import {
  DIAGRAM_PDF_TEXT_FONT_FAMILY,
  flattenDiagramSvgGradientRefs,
  normalizeDiagramSvgColorForPdf,
  prepareSvgRootForVectorPdf,
  representativeColorFromSvgGradient,
} from "./stage-design-svg-pdf-prep";

describe("normalizeDiagramSvgColorForPdf", () => {
  it("converts rgba to hex and opacity", () => {
    expect(normalizeDiagramSvgColorForPdf("rgba(96,165,250,0.95)")).toEqual({
      paint: "#60a5fa",
      opacity: 0.95,
    });
  });

  it("keeps opaque rgb as hex without opacity", () => {
    expect(normalizeDiagramSvgColorForPdf("rgb(10, 12, 14)")).toEqual({
      paint: "#0a0c0e",
    });
  });

  it("splits eight-digit hex alpha", () => {
    expect(normalizeDiagramSvgColorForPdf("#60a5faff")).toEqual({
      paint: "#60a5fa",
    });
    const half = normalizeDiagramSvgColorForPdf("#60a5fa80");
    expect(half?.paint).toBe("#60a5fa");
    expect(half?.opacity).toBeCloseTo(128 / 255, 3);
  });

  it("preserves none and transparent", () => {
    expect(normalizeDiagramSvgColorForPdf("none")).toEqual({ paint: "none" });
    expect(normalizeDiagramSvgColorForPdf("transparent")).toEqual({ paint: "transparent" });
  });
});

describe("flattenDiagramSvgGradientRefs", () => {
  it("resolves url(#…) fills to the lowest-offset gradient stop color", () => {
    const stopAttrs: Record<string, string> = { offset: "0", "stop-color": "rgba(96,165,250,0.9)" };
    const stop = {
      tagName: "stop",
      getAttribute: (name: string) => stopAttrs[name] ?? null,
      querySelectorAll: () => [],
      childNodes: [],
    } as unknown as Element;

    const gradient = {
      tagName: "linearGradient",
      getAttribute: (name: string) => (name === "id" ? "g1" : null),
      querySelectorAll: (sel: string) => (sel === "stop" ? [stop] : []),
      childNodes: [],
    } as unknown as Element;

    expect(representativeColorFromSvgGradient(gradient)).toBe("#60a5fa");

    const rectAttrs: Record<string, string> = { fill: "url(#g1)" };
    const rect = {
      tagName: "rect",
      getAttribute: (name: string) => rectAttrs[name] ?? null,
      setAttribute: (name: string, value: string) => {
        rectAttrs[name] = value;
      },
      childNodes: [],
    } as unknown as Element;

    const root = {
      tagName: "svg",
      getAttribute: () => null,
      childNodes: [gradient, rect],
      querySelectorAll: () => [],
    } as unknown as Element;

    flattenDiagramSvgGradientRefs(root);

    expect(rectAttrs.fill).toBe("#60a5fa");
  });
});

describe("prepareSvgRootForVectorPdf", () => {
  it("rewrites rgba fills and sets PDF-safe text font", () => {
    const attrs: Record<string, string> = {
      fill: "rgba(248,250,252,0.92)",
      stroke: "rgba(10,12,14,0.5)",
      "font-family": "system-ui, Segoe UI, sans-serif",
      "paint-order": "stroke fill",
    };
    const text = {
      tagName: "text",
      hasAttribute: (name: string) => attrs[name] !== undefined,
      getAttribute: (name: string) => attrs[name] ?? null,
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
      removeAttribute: (name: string) => {
        delete attrs[name];
      },
      childNodes: [],
    } as unknown as Element;

    prepareSvgRootForVectorPdf(text);

    expect(attrs.fill).toBe("#f8fafc");
    expect(Number.parseFloat(attrs["fill-opacity"] ?? "0")).toBeCloseTo(0.92, 3);
    expect(attrs.stroke).toBe("#0a0c0e");
    expect(Number.parseFloat(attrs["stroke-opacity"] ?? "0")).toBeCloseTo(0.5, 3);
    expect(attrs["font-family"]).toBe(DIAGRAM_PDF_TEXT_FONT_FAMILY);
    expect(attrs["paint-order"]).toBeUndefined();
  });
});

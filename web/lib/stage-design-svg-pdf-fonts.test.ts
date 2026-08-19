import { describe, expect, it } from "vitest";

import {
  buildDiagramPdfPrebuiltCharset,
  collectDiagramSvgTextCharset,
  DIAGRAM_PDF_FONT_BASE_CHARSET,
  uint8ArrayToBase64,
} from "./stage-design-svg-pdf-fonts";

describe("collectDiagramSvgTextCharset", () => {
  it("includes base charset plus text and tspan content", () => {
    const text = {
      tagName: "text",
      textContent: "LX-1 · U1.ch",
      childNodes: [],
    } as unknown as Element;
    const tspan = {
      tagName: "tspan",
      textContent: "DMX",
      childNodes: [],
    } as unknown as Element;
    const root = {
      tagName: "svg",
      textContent: "",
      childNodes: [text, tspan],
    } as unknown as Element;

    const charset = collectDiagramSvgTextCharset(root);
    for (const ch of DIAGRAM_PDF_FONT_BASE_CHARSET) {
      expect(charset.includes(ch)).toBe(true);
    }
    expect(charset.includes("L")).toBe(true);
    expect(charset.includes("·")).toBe(true);
    expect(charset.includes("M")).toBe(true);
  });

  it("prebuilt charset covers typical diagram labels", () => {
    const prebuilt = buildDiagramPdfPrebuiltCharset();
    expect(prebuilt.includes("é")).toBe(true);
    expect(prebuilt.includes("·")).toBe(true);
    const text = {
      tagName: "text",
      textContent: "Café LX-1",
      childNodes: [],
    } as unknown as Element;
    const root = { tagName: "svg", childNodes: [text] } as unknown as Element;
    const used = collectDiagramSvgTextCharset(root);
    for (const ch of used) {
      expect(prebuilt.includes(ch)).toBe(true);
    }
  });
});

describe("uint8ArrayToBase64", () => {
  it("round-trips small byte arrays", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    expect(atob(uint8ArrayToBase64(bytes))).toBe("Hello");
  });
});

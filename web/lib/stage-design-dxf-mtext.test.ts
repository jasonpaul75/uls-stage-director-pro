import { describe, expect, it } from "vitest";

import { stripMinimalMtextMarkup } from "./stage-design-dxf-mtext";

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
});

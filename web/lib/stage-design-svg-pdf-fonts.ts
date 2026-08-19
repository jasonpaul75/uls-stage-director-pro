import type { jsPDF } from "jspdf";

import { isElementNode } from "./stage-design-svg-pdf-prep";

/** jsPDF registered name for the diagram embedded subset font. */
export const DIAGRAM_PDF_EMBEDDED_FONT_NAME = "ULSDiagramSans";

/** Helvetica stack when subset embedding fails (svg2pdf built-in). */
export const DIAGRAM_PDF_FALLBACK_FONT_FAMILY = "Helvetica, Arial, sans-serif";

/** Pre-built HarfBuzz subset (see `scripts/build-diagram-font-subset.mjs`). */
export const DIAGRAM_PDF_SUBSET_FONT_URL = "/fonts/ULSDiagramSans-subset.ttf";

/** Full Roboto when diagram text uses glyphs outside the pre-built subset. */
export const DIAGRAM_PDF_FULL_FONT_URL = "/fonts/Roboto-Regular.ttf";

const DIAGRAM_PDF_VFS_FILENAME = "uls-diagram-sans.ttf";

/** Minimum glyphs always included (empty plots, numeric labels, equipment tokens). */
export const DIAGRAM_PDF_FONT_BASE_CHARSET =
  " \t\n\r" +
  "0123456789" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  "'\"-–—·/\\()[]{}@#$%&*+=<>?;:,.°`~_|";

/** Extended Latin diacritics included in the build-time subset file. */
export const DIAGRAM_PDF_FONT_EXTENDED_CHARSET =
  "éèêëáàâäíìîïóòôöúùûüñçßÉÈÊËÁÀÂÄÍÌÎÏÓÒÔÖÚÙÛÜÑÇ";

export function buildDiagramPdfPrebuiltCharset(): string {
  const seen = new Set<string>();
  for (const ch of DIAGRAM_PDF_FONT_BASE_CHARSET + DIAGRAM_PDF_FONT_EXTENDED_CHARSET) {
    seen.add(ch);
  }
  return [...seen].join("");
}

function charsetWithinPrebuilt(textCharset: string, prebuilt: string): boolean {
  const allowed = new Set(prebuilt);
  for (const ch of textCharset) {
    if (!allowed.has(ch)) return false;
  }
  return true;
}

function appendUniqueChars(target: Set<string>, text: string): void {
  for (const ch of text) target.add(ch);
}

/** Collect every character used by `<text>` / `<tspan>` nodes plus {@link DIAGRAM_PDF_FONT_BASE_CHARSET}. */
export function collectDiagramSvgTextCharset(root: Element): string {
  const seen = new Set<string>();
  appendUniqueChars(seen, DIAGRAM_PDF_FONT_BASE_CHARSET);
  const stack: Element[] = [root];
  while (stack.length > 0) {
    const el = stack.pop()!;
    const tag = el.tagName.toLowerCase();
    if (tag === "text" || tag === "tspan") appendUniqueChars(seen, el.textContent ?? "");
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (isElementNode(child)) stack.push(child);
    }
  }
  return [...seen].join("");
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export type RegisterDiagramEmbeddedFontResult = {
  ok: boolean;
  fontFamily: string;
  /** True when the smaller pre-built subset TTF was embedded (vs full Roboto). */
  usedPrebuiltSubset?: boolean;
};

/**
 * Embed Roboto for diagram labels: pre-built HarfBuzz subset when all glyphs are covered,
 * else the full TTF. Falls back to Helvetica when fetch/register fails.
 */
export async function registerDiagramEmbeddedFontOnJsPdf(
  pdf: jsPDF,
  svgRoot: Element,
): Promise<RegisterDiagramEmbeddedFontResult> {
  const fallback = { ok: false, fontFamily: DIAGRAM_PDF_FALLBACK_FONT_FAMILY };
  if (typeof fetch === "undefined" || typeof btoa === "undefined") return fallback;
  try {
    const textCharset = collectDiagramSvgTextCharset(svgRoot);
    const prebuilt = buildDiagramPdfPrebuiltCharset();
    const fontUrl = charsetWithinPrebuilt(textCharset, prebuilt)
      ? DIAGRAM_PDF_SUBSET_FONT_URL
      : DIAGRAM_PDF_FULL_FONT_URL;
    const res = await fetch(fontUrl);
    if (!res.ok) return fallback;
    const bytes = new Uint8Array(await res.arrayBuffer());
    pdf.addFileToVFS(DIAGRAM_PDF_VFS_FILENAME, uint8ArrayToBase64(bytes));
    pdf.addFont(DIAGRAM_PDF_VFS_FILENAME, DIAGRAM_PDF_EMBEDDED_FONT_NAME, "normal");
    pdf.setFont(DIAGRAM_PDF_EMBEDDED_FONT_NAME, "normal");
    return {
      ok: true,
      fontFamily: DIAGRAM_PDF_EMBEDDED_FONT_NAME,
      usedPrebuiltSubset: fontUrl === DIAGRAM_PDF_SUBSET_FONT_URL,
    };
  } catch {
    return fallback;
  }
}

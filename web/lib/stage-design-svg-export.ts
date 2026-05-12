import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import { svg2pdf } from "svg2pdf.js";

import { STAGE_SVG_VIEW_H, STAGE_SVG_VIEW_W } from "./stage-design-svg-layout";

/**
 * Marks SVG fragments removed from downloadable diagram exports ({@link svgDiagramSerializedForExport}).
 * Apply as `data-ulsd-export-exclude` on authoring-only overlays (guides, resize/rotate handles).
 */
export const ULSD_DIAGRAM_EXPORT_EXCLUDE_ATTR = "data-ulsd-export-exclude";

/** Attribute selector matching {@link ULSD_DIAGRAM_EXPORT_EXCLUDE_ATTR}. */
export const ULSD_DIAGRAM_EXPORT_EXCLUDE_SELECTOR = `[${ULSD_DIAGRAM_EXPORT_EXCLUDE_ATTR}]`;

/**
 * Marks authoring grid (`defs` pattern + plot rect placeholder for export rewriting).
 */
export const ULSD_AUTHORING_GRID_ATTR = "data-ulsd-export-authoring-grid";

const ULSD_AUTHORING_GRID_SELECTOR = `[${ULSD_AUTHORING_GRID_ATTR}]`;

/** Producer deck polygons: export rewrites fill/stroke to match {@link StageFootprintPreview} presentation mode. */
export const ULSD_PRESENTATION_DECK_FILL_ATTR = "data-ulsd-presentation-deck-fill";
export const ULSD_PRESENTATION_DECK_STROKE_ATTR = "data-ulsd-presentation-deck-stroke";

/** Inner plot backdrop in {@link StageFootprintPreview} presentation mode — applied on export after grid strip. */
export const PRESENTATION_PLOT_RECT_FILL_EXPORT = "rgba(255,255,255,0.018)";
export const PRESENTATION_PLOT_RECT_STROKE_EXPORT = "rgba(255,255,255,0.06)";

/** Shape/symbol selection chrome stroke. */
const PROD_SELECTION_STROKE = "rgba(96,165,250,0.95)";
/** Default non-selected stroke for shapes (`ShapeDraw`). */
const SHAPE_REST_STROKE_EXPORT = "rgba(244,244,245,0.45)";

export type SvgDiagramExportOptions = {
  /**
   * Match director-style snapshot: no authoring grid and no transient producer selection styling.
   * Default `true`.
   */
  presentationSnapshot?: boolean;
};

function stripAuthoringGridFromDiagramExportClone(svgClone: SVGSVGElement): void {
  svgClone.querySelectorAll(ULSD_AUTHORING_GRID_SELECTOR).forEach((node) => {
    const tag = node.tagName.toLowerCase();
    if (tag === "defs") {
      node.parentNode?.removeChild(node);
      return;
    }
    if (tag === "rect") {
      node.setAttribute("fill", PRESENTATION_PLOT_RECT_FILL_EXPORT);
      node.setAttribute("stroke", PRESENTATION_PLOT_RECT_STROKE_EXPORT);
      node.removeAttribute(ULSD_AUTHORING_GRID_ATTR);
    }
  });
}

function svgStrokeWidthAttr(el: Element): string | null {
  return el.getAttribute("stroke-width") ?? el.getAttribute("strokeWidth");
}

function setSvgStrokeWidthAttr(el: Element, value: string): void {
  el.setAttribute("stroke-width", value);
}

/** Exported for targeted unit tests (`web/lib/stage-design-svg-export.test.ts`). */
export function downgradeSelectionAppearanceForDiagramExport(el: Element): boolean {
  const stroke = el.getAttribute("stroke");
  const strokeWidth = svgStrokeWidthAttr(el);
  const tag = el.tagName.toLowerCase();

  if (!stroke || strokeWidth == null) return false;

  if (stroke !== PROD_SELECTION_STROKE) return false;

  el.setAttribute("stroke", SHAPE_REST_STROKE_EXPORT);

  if (tag === "line") {
    const sw = Number.parseFloat(strokeWidth);
    setSvgStrokeWidthAttr(el, Number.isFinite(sw) && sw > 2 ? "1.75" : strokeWidth);
  } else if (tag === "polyline") {
    const sw = Number.parseFloat(strokeWidth);
    setSvgStrokeWidthAttr(el, Number.isFinite(sw) && sw > 2 ? "1.75" : strokeWidth);
  } else if (tag === "rect" || tag === "ellipse") {
    setSvgStrokeWidthAttr(el, "1.25");
  }

  return true;
}

/** Apply deck presentation fill/stroke from producer-only data attrs (matches portal snapshot). Exported for tests. */
export function applyPresentationDeckMarkersForExport(poly: Element): boolean {
  const tag = poly.tagName.toLowerCase();
  if (tag !== "polygon") return false;
  const f = poly.getAttribute(ULSD_PRESENTATION_DECK_FILL_ATTR);
  const s = poly.getAttribute(ULSD_PRESENTATION_DECK_STROKE_ATTR);
  if (f === null && s === null) return false;
  if (f !== null) poly.setAttribute("fill", f);
  if (s !== null) poly.setAttribute("stroke", s);
  setSvgStrokeWidthAttr(poly, "2");
  poly.removeAttribute(ULSD_PRESENTATION_DECK_FILL_ATTR);
  poly.removeAttribute(ULSD_PRESENTATION_DECK_STROKE_ATTR);
  return true;
}

function normalizeDeckPresentationForExportClone(svgClone: SVGSVGElement): void {
  const sel = `polygon[${ULSD_PRESENTATION_DECK_FILL_ATTR}], polygon[${ULSD_PRESENTATION_DECK_STROKE_ATTR}]`;
  svgClone.querySelectorAll(sel).forEach((poly) => {
    applyPresentationDeckMarkersForExport(poly);
  });
}

function normalizeProducerSelectionForPresentationExport(svgClone: SVGSVGElement): void {
  svgClone.querySelectorAll("line, polyline, rect, ellipse").forEach((el) => {
    downgradeSelectionAppearanceForDiagramExport(el);
  });
}

/**
 * Normalize a slug for `{slug}.svg` — filesystem-friendly, capped length, never empty fallbacks.
 */
export function sanitizeDiagramSvgFilenameSlug(raw: string): string {
  const t = raw
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return t.length > 0 ? t : "stage-diagram";
}

/**
 * Clone producer plot SVG for export: strips nodes marked {@link ULSD_DIAGRAM_EXPORT_EXCLUDE_ATTR};
 * optionally rewrites grid + selection to match read-only presentation (director-style).
 * Intended for browser-only use (`XMLSerializer` / DOM).
 */
export function svgDiagramSerializedForExport(
  svgRoot: SVGSVGElement,
  opts?: SvgDiagramExportOptions,
): string {
  const presentation = opts?.presentationSnapshot !== false;
  const clone = svgRoot.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll(ULSD_DIAGRAM_EXPORT_EXCLUDE_SELECTOR).forEach((n) => {
    n.parentNode?.removeChild(n);
  });
  if (presentation) {
    stripAuthoringGridFromDiagramExportClone(clone);
    normalizeDeckPresentationForExportClone(clone);
    normalizeProducerSelectionForPresentationExport(clone);
  }
  clone.setAttribute("viewBox", `0 0 ${STAGE_SVG_VIEW_W} ${STAGE_SVG_VIEW_H}`);
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  return new XMLSerializer().serializeToString(clone);
}

export function triggerSvgDiagramDownload(serializedSvg: string, filename: string): void {
  const blob = new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Default raster width for PNG diagram download (height follows {@link STAGE_SVG_VIEW_W} / {@link STAGE_SVG_VIEW_H}). */
export const STAGE_DIAGRAM_EXPORT_PNG_DEFAULT_WIDTH = 1080;

/** Pixel canvas size for raster export; clamps width to a safe range. Exported for tests. */
export function diagramExportPngPixelSize(pixelWidth: number): { w: number; h: number } {
  const w = Math.max(64, Math.min(8192, Math.round(pixelWidth)));
  const h = Math.round((w * STAGE_SVG_VIEW_H) / STAGE_SVG_VIEW_W);
  return { w, h };
}

function prepareSerializedSvgForRasterization(serializedSvg: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(serializedSvg, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") return serializedSvg;
  root.setAttribute("width", String(STAGE_SVG_VIEW_W));
  root.setAttribute("height", String(STAGE_SVG_VIEW_H));
  return new XMLSerializer().serializeToString(root);
}

/**
 * Rasterize a diagram SVG string to PNG (same visual path as {@link svgDiagramSerializedForExport} output).
 * Browser-only (`canvas` / `Image`). Returns `null` if decode or canvas fails.
 */
export async function diagramPngBlobFromSerializedSvg(
  serializedSvg: string,
  pixelWidth: number = STAGE_DIAGRAM_EXPORT_PNG_DEFAULT_WIDTH,
): Promise<Blob | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  const { w, h } = diagramExportPngPixelSize(pixelWidth);
  const prepared = prepareSerializedSvgForRasterization(serializedSvg);
  const svgBlob = new Blob([prepared], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.decoding = "async";
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("diagram svg raster decode failed"));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "rgb(10,12,14)";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function triggerPngDiagramDownload(
  serializedSvg: string,
  filename: string,
  pixelWidth?: number,
): Promise<boolean> {
  const blob = await diagramPngBlobFromSerializedSvg(serializedSvg, pixelWidth);
  if (!blob) return false;
  const name = filename.endsWith(".png") ? filename : `${filename}.png`;
  const durl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = durl;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(durl);
  return true;
}

/** US Letter landscape in PDF points (72 pt/in × 11 in × 8.5 in). */
export const STAGE_DIAGRAM_EXPORT_PDF_PAGE_W_PT = 792;
export const STAGE_DIAGRAM_EXPORT_PDF_PAGE_H_PT = 612;

/**
 * Scale bitmap dimensions to fit a landscape page while preserving aspect; returns draw size + top-left offset
 * assuming a top-left page origin ( callers convert **`y`** to PDF bottom-left when drawing).
 */
export function diagramPdfLetterLandscapeEmbedLayout(
  imageWidthPx: number,
  imageHeightPx: number,
  pageWPt = STAGE_DIAGRAM_EXPORT_PDF_PAGE_W_PT,
  pageHPt = STAGE_DIAGRAM_EXPORT_PDF_PAGE_H_PT,
): { drawW: number; drawH: number; dx: number; dyFromTop: number } {
  const iw = Math.max(1, imageWidthPx);
  const ih = Math.max(1, imageHeightPx);
  const s = Math.min(pageWPt / iw, pageHPt / ih);
  const drawW = iw * s;
  const drawH = ih * s;
  return {
    drawW,
    drawH,
    dx: (pageWPt - drawW) / 2,
    dyFromTop: (pageHPt - drawH) / 2,
  };
}

/**
 * Vector snapshot PDF: **`svg2pdf.js`** renders presentation SVG geometry on Letter landscape (**{@link diagramPdfLetterLandscapeEmbedLayout}** layout).
 * Returns `null` when `SVG` → PDF conversion fails (missing DOM, parse errors, or unsupported SVG primitives).
 *
 * Raster fallback for the same framing is **`{@link diagramRasterPdfBlobFromSerializedSvg}`**.
 */
export async function diagramVectorPdfBlobFromSerializedSvg(serializedSvg: string): Promise<Blob | null> {
  if (typeof DOMParser === "undefined") return null;
  try {
    const parsed = new DOMParser().parseFromString(serializedSvg, "image/svg+xml");
    const svg = parsed.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== "svg") return null;

    const pageW = STAGE_DIAGRAM_EXPORT_PDF_PAGE_W_PT;
    const pageH = STAGE_DIAGRAM_EXPORT_PDF_PAGE_H_PT;
    const lay = diagramPdfLetterLandscapeEmbedLayout(STAGE_SVG_VIEW_W, STAGE_SVG_VIEW_H, pageW, pageH);

    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [pageW, pageH] });
    pdf.setDocumentProperties({
      title: "Stage diagram",
      creator: "ULS Stage Director PRO",
    });
    pdf.setFillColor(10, 12, 14);
    pdf.rect(0, 0, pageW, pageH, "F");

    await svg2pdf(svg, pdf, {
      x: lay.dx,
      y: lay.dyFromTop,
      width: lay.drawW,
      height: lay.drawH,
    });

    return pdf.output("blob");
  } catch {
    return null;
  }
}

/**
 * Raster snapshot PDF (**{@link diagramPngBlobFromSerializedSvg}** → **`pdf-lib`**) Letter landscape embed.
 */
export async function diagramRasterPdfBlobFromSerializedSvg(
  serializedSvg: string,
  pixelWidth: number = STAGE_DIAGRAM_EXPORT_PNG_DEFAULT_WIDTH,
): Promise<Blob | null> {
  const pngBlob = await diagramPngBlobFromSerializedSvg(serializedSvg, pixelWidth);
  if (!pngBlob) return null;
  try {
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle("Stage diagram");
    pdfDoc.setProducer("ULS Stage Director PRO");
    const pngImage = await pdfDoc.embedPng(pngBytes);
    const pageW = STAGE_DIAGRAM_EXPORT_PDF_PAGE_W_PT;
    const pageH = STAGE_DIAGRAM_EXPORT_PDF_PAGE_H_PT;
    const lay = diagramPdfLetterLandscapeEmbedLayout(pngImage.width, pngImage.height, pageW, pageH);
    const page = pdfDoc.addPage([pageW, pageH]);
    /** PDF origin bottom-left */
    const yPdf = pageH - lay.dyFromTop - lay.drawH;
    page.drawImage(pngImage, {
      x: lay.dx,
      y: yPdf,
      width: lay.drawW,
      height: lay.drawH,
    });
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    ) as ArrayBuffer;
    return new Blob([pdfBuffer], { type: "application/pdf" });
  } catch {
    return null;
  }
}

/**
 * Presentation snapshot PDF: **vector** (**{@link diagramVectorPdfBlobFromSerializedSvg}**) when conversion succeeds,
 * else **raster** (**{@link diagramRasterPdfBlobFromSerializedSvg}**). Same framing on US Letter landscape.
 */
export async function diagramPdfBlobFromSerializedSvg(
  serializedSvg: string,
  pixelWidth: number = STAGE_DIAGRAM_EXPORT_PNG_DEFAULT_WIDTH,
): Promise<Blob | null> {
  const vector = await diagramVectorPdfBlobFromSerializedSvg(serializedSvg);
  if (vector) return vector;
  return diagramRasterPdfBlobFromSerializedSvg(serializedSvg, pixelWidth);
}

export async function triggerPdfDiagramDownload(
  serializedSvg: string,
  filename: string,
  pixelWidth?: number,
): Promise<boolean> {
  const blob = await diagramPdfBlobFromSerializedSvg(serializedSvg, pixelWidth);
  if (!blob) return false;
  const name = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  const durl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = durl;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(durl);
  return true;
}

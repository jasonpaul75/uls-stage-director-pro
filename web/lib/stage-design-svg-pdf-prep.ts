/** PDF-safe Helvetica stack for svg2pdf.js (system-ui is not embeddable). */
export const DIAGRAM_PDF_TEXT_FONT_FAMILY = "Helvetica, Arial, sans-serif";

export function isElementNode(node: unknown): node is Element {
  return (
    typeof node === "object" &&
    node !== null &&
    "tagName" in node &&
    typeof (node as { tagName: unknown }).tagName === "string"
  );
}

export type DiagramSvgPdfColorNorm = {
  paint: string;
  opacity?: number;
};

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clampUnit(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function hexByte(n: number): string {
  return clamp255(n).toString(16).padStart(2, "0");
}

function expandShortHex(hex: string): string | null {
  if (hex.length === 3) {
    return hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length === 4) {
    return hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return null;
}

/**
 * Normalize SVG/CSS colors for vector PDF (`svg2pdf.js`): `#rgb`/`#rrggbb`/`#rrggbbaa` and `rgb()`/`rgba()`.
 */
export function normalizeDiagramSvgColorForPdf(raw: string): DiagramSvgPdfColorNorm | null {
  const t = raw.trim();
  if (t.length === 0) return null;
  const lower = t.toLowerCase();
  if (lower === "none" || lower === "transparent" || lower === "currentcolor") {
    return { paint: t };
  }

  const rgbaMatch = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(t);
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const aRaw = rgbaMatch[4];
    const a = aRaw !== undefined ? clampUnit(Number(aRaw)) : 1;
    if (!Number.isFinite(r * g * b)) return null;
    const paint = `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
    return a < 1 - 1e-6 ? { paint, opacity: a } : { paint };
  }

  if (t.startsWith("#")) {
    const hex = t.slice(1);
    if (/^[0-9a-fA-F]{8}$/.test(hex)) {
      const rgb = hex.slice(0, 6);
      const a = clampUnit(Number.parseInt(hex.slice(6, 8), 16) / 255);
      return a < 1 - 1e-6 ? { paint: `#${rgb}`, opacity: a } : { paint: `#${rgb}` };
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return { paint: `#${hex}` };
    const expanded = expandShortHex(hex);
    if (expanded && /^[0-9a-fA-F]{6}$/.test(expanded)) return { paint: `#${expanded}` };
    if (expanded && /^[0-9a-fA-F]{8}$/.test(expanded)) {
      const rgb = expanded.slice(0, 6);
      const a = clampUnit(Number.parseInt(expanded.slice(6, 8), 16) / 255);
      return a < 1 - 1e-6 ? { paint: `#${rgb}`, opacity: a } : { paint: `#${rgb}` };
    }
  }

  return { paint: t };
}

const PDF_COLOR_ATTRS = ["fill", "stroke", "stop-color", "flood-color", "lighting-color"] as const;

function multiplyOpacityAttr(el: Element, attr: "fill-opacity" | "stroke-opacity" | "stop-opacity", factor: number): void {
  const prev = Number.parseFloat(el.getAttribute(attr) ?? "1");
  const base = Number.isFinite(prev) ? prev : 1;
  el.setAttribute(attr, String(clampUnit(base * factor)));
}

function normalizeColorAttr(el: Element, attr: string): void {
  const raw = el.getAttribute(attr);
  if (raw === null) return;
  const norm = normalizeDiagramSvgColorForPdf(raw);
  if (!norm) return;
  el.setAttribute(attr, norm.paint);
  if (norm.opacity !== undefined) {
    const opAttr =
      attr === "fill" || attr === "flood-color"
        ? "fill-opacity"
        : attr === "stroke"
          ? "stroke-opacity"
          : attr === "stop-color"
            ? "stop-opacity"
            : null;
    if (opAttr) multiplyOpacityAttr(el, opAttr, norm.opacity);
  }
}

function parseSvgUrlRef(raw: string): string | null {
  const m = /^url\(\s*["']?#([^"')]+)["']?\s*\)$/i.exec(raw.trim());
  return m?.[1] ?? null;
}

function parseCssColorFromStyle(style: string, prop: string): string | null {
  const re = new RegExp(`${prop}\\s*:\\s*([^;]+)`, "i");
  const m = re.exec(style);
  return m?.[1]?.trim() ?? null;
}

function gradientStopColor(stop: Element): string | null {
  const direct = stop.getAttribute("stop-color");
  if (direct) return direct;
  const style = stop.getAttribute("style");
  if (style) return parseCssColorFromStyle(style, "stop-color");
  return null;
}

/** Pick the stop at the lowest offset (defaults to first) as a flat fill substitute. */
export function representativeColorFromSvgGradient(gradient: Element): string | null {
  const stops = [...gradient.querySelectorAll("stop")];
  if (stops.length === 0) return null;
  let best: Element | null = null;
  let bestOffset = Number.POSITIVE_INFINITY;
  for (const stop of stops) {
    const raw = stop.getAttribute("offset") ?? "0";
    const pct = raw.trim().endsWith("%") ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
    const off = Number.isFinite(pct) ? pct : 0;
    if (off <= bestOffset) {
      bestOffset = off;
      best = stop;
    }
  }
  const chosen = best ?? stops[0]!;
  const color = gradientStopColor(chosen);
  if (!color) return null;
  const norm = normalizeDiagramSvgColorForPdf(color);
  return norm?.paint ?? color;
}

function buildSvgGradientMap(root: Element): Map<string, string> {
  const map = new Map<string, string>();
  const stack: Element[] = [root];
  while (stack.length > 0) {
    const el = stack.pop()!;
    const tag = el.tagName.toLowerCase();
    if (tag === "lineargradient" || tag === "radialgradient") {
      const id = el.getAttribute("id");
      const color = representativeColorFromSvgGradient(el);
      if (id && color) map.set(id, color);
    }
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (isElementNode(child)) stack.push(child);
    }
  }
  return map;
}

function resolveGradientPaintAttr(
  el: Element,
  attr: "fill" | "stroke",
  gradients: ReadonlyMap<string, string>,
): void {
  const raw = el.getAttribute(attr);
  if (!raw) return;
  const ref = parseSvgUrlRef(raw);
  if (!ref) return;
  const flat = gradients.get(ref);
  if (!flat) return;
  el.setAttribute(attr, flat);
}

function flattenInlineGradientStyles(el: Element, gradients: ReadonlyMap<string, string>): void {
  const style = el.getAttribute("style");
  if (!style) return;
  let next = style;
  for (const prop of ["fill", "stroke"] as const) {
    const val = parseCssColorFromStyle(next, prop);
    if (!val) continue;
    const ref = parseSvgUrlRef(val);
    if (!ref) continue;
    const flat = gradients.get(ref);
    if (!flat) continue;
    next = next.replace(new RegExp(`(${prop}\\s*:\\s*)[^;]+`, "i"), `$1${flat}`);
  }
  if (next !== style) el.setAttribute("style", next);
}

/** Replace `url(#gradientId)` fills/strokes with a flat stop color for svg2pdf.js. */
export function flattenDiagramSvgGradientRefs(root: Element): void {
  const gradients = buildSvgGradientMap(root);
  if (gradients.size === 0) return;
  const stack: Element[] = [root];
  while (stack.length > 0) {
    const el = stack.pop()!;
    resolveGradientPaintAttr(el, "fill", gradients);
    resolveGradientPaintAttr(el, "stroke", gradients);
    flattenInlineGradientStyles(el, gradients);
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (isElementNode(child)) stack.push(child);
    }
  }
}

/** Walk an SVG subtree and rewrite colors/fonts for svg2pdf.js fidelity. */
export function prepareSvgRootForVectorPdf(
  root: Element,
  opts?: { fontFamily?: string },
): void {
  const fontFamily = opts?.fontFamily ?? DIAGRAM_PDF_TEXT_FONT_FAMILY;
  flattenDiagramSvgGradientRefs(root);
  const stack: Element[] = [root];
  while (stack.length > 0) {
    const el = stack.pop()!;
    for (const attr of PDF_COLOR_ATTRS) {
      if (el.hasAttribute(attr)) normalizeColorAttr(el, attr);
    }
    if (el.hasAttribute("opacity")) {
      const o = Number.parseFloat(el.getAttribute("opacity") ?? "1");
      if (Number.isFinite(o) && o >= 0 && o <= 1) el.setAttribute("opacity", String(o));
    }
    el.removeAttribute("paint-order");
    el.removeAttribute("paintOrder");
    el.removeAttribute("pointer-events");
    if (el.tagName.toLowerCase() === "text") {
      el.setAttribute("font-family", fontFamily);
    }
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (isElementNode(child)) stack.push(child);
    }
  }
}

/** Parse serialized presentation SVG and return a vector-PDF-safe string. */
export function prepareSerializedSvgForVectorPdf(serializedSvg: string): string | null {
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return null;
  try {
    const parsed = new DOMParser().parseFromString(serializedSvg, "image/svg+xml");
    const root = parsed.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg") return null;
    prepareSvgRootForVectorPdf(root);
    if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(root);
  } catch {
    return null;
  }
}

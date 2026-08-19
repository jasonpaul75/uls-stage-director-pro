import type { DxfPair } from "./stage-design-dxf-hatch";

export type DxfHatchPatternLineDef = {
  angleDeg: number;
  baseX: number;
  baseY: number;
  offsetX: number;
  offsetY: number;
  dashes: readonly number[];
};

export type DxfHatchPatternDef = {
  name: string | null;
  angleDeg: number;
  scale: number;
  double: boolean;
  lines: readonly DxfHatchPatternLineDef[];
};

export type DxfHatchPatternSegment = { x1: number; y1: number; x2: number; y2: number };

const LW_EPS = 1e-9;
const MAX_PATTERN_LINES_PER_LOOP = 120;

function parseNum(raw: string): number | undefined {
  const v = Number(String(raw).trim());
  return Number.isFinite(v) ? v : undefined;
}

/** Common AutoCAD `.pat` families used when DXF stores only the pattern name. */
const DXF_HATCH_BUILTIN_PATTERN_LINES: Readonly<Record<string, readonly DxfHatchPatternLineDef[]>> = {
  ANSI31: [{ angleDeg: 45, baseX: 0, baseY: 0, offsetX: 0, offsetY: 0.125, dashes: [] }],
  ANSI32: [{ angleDeg: 45, baseX: 0, baseY: 0, offsetX: 0, offsetY: 0.375, dashes: [] }],
  ANSI33: [{ angleDeg: 45, baseX: 0, baseY: 0, offsetX: 0, offsetY: 0.75, dashes: [] }],
  ANSI34: [{ angleDeg: 45, baseX: 0, baseY: 0, offsetX: 0, offsetY: 1.125, dashes: [] }],
  ANSI37: [{ angleDeg: 45, baseX: 0, baseY: 0, offsetX: 0, offsetY: 0.125, dashes: [] }],
  ANSI38: [{ angleDeg: 45, baseX: 0, baseY: 0, offsetX: 0, offsetY: 2.1875, dashes: [] }],
  DOTS: [{ angleDeg: 0, baseX: 0, baseY: 0, offsetX: 0.03125, offsetY: 0.0625, dashes: [0, 0.0625] }],
  GRID: [
    { angleDeg: 0, baseX: 0, baseY: 0, offsetX: 0, offsetY: 1, dashes: [] },
    { angleDeg: 90, baseX: 0, baseY: 0, offsetX: 0, offsetY: 1, dashes: [] },
  ],
};

function lookupBuiltinPatternLines(name: string): readonly DxfHatchPatternLineDef[] | null {
  const key = name.trim().toUpperCase();
  const lines = DXF_HATCH_BUILTIN_PATTERN_LINES[key];
  return lines ?? null;
}

type PatternParserState = {
  angleDeg: number;
  scale: number;
  double: boolean;
  lines: DxfHatchPatternLineDef[];
  pendingLine: Partial<DxfHatchPatternLineDef> | null;
  dashCount: number;
  dashRemaining: number;
};

function createPatternParserState(): PatternParserState {
  return {
    angleDeg: 0,
    scale: 1,
    double: false,
    lines: [],
    pendingLine: null,
    dashCount: 0,
    dashRemaining: 0,
  };
}

function flushPendingLine(state: PatternParserState): void {
  const p = state.pendingLine;
  if (!p) return;
  const angleDeg = p.angleDeg ?? 0;
  const baseX = p.baseX ?? 0;
  const baseY = p.baseY ?? 0;
  const offsetX = p.offsetX ?? 0;
  const offsetY = p.offsetY ?? 0;
  const dashes = p.dashes ?? [];
  state.lines.push({ angleDeg, baseX, baseY, offsetX, offsetY, dashes: [...dashes] });
  state.pendingLine = null;
  state.dashCount = 0;
  state.dashRemaining = 0;
}

/** Incrementally consume HATCH pattern group codes (52/41/78/53…). */
export function feedDxfHatchPatternPair(state: PatternParserState, pair: DxfPair): boolean {
  const { code, value } = pair;
  if (code === 52) {
    const v = parseNum(value);
    if (v !== undefined) state.angleDeg = v;
    return true;
  }
  if (code === 41) {
    const v = parseNum(value);
    if (v !== undefined && v > LW_EPS) state.scale = v;
    return true;
  }
  if (code === 77) {
    const v = parseNum(value);
    if (v === 1) state.double = true;
    return true;
  }
  if (code === 78) {
    flushPendingLine(state);
    return true;
  }
  if (code === 53) {
    flushPendingLine(state);
    state.pendingLine = { angleDeg: parseNum(value) ?? 0, dashes: [] };
    return true;
  }
  if (code === 43 && state.pendingLine) {
    state.pendingLine.baseX = parseNum(value) ?? 0;
    return true;
  }
  if (code === 44 && state.pendingLine) {
    state.pendingLine.baseY = parseNum(value) ?? 0;
    return true;
  }
  if (code === 45 && state.pendingLine) {
    state.pendingLine.offsetX = parseNum(value) ?? 0;
    return true;
  }
  if (code === 46 && state.pendingLine) {
    state.pendingLine.offsetY = parseNum(value) ?? 0;
    return true;
  }
  if (code === 79) {
    if (!state.pendingLine) state.pendingLine = { angleDeg: 0, dashes: [] };
    state.dashCount = parseNum(value) ?? 0;
    state.dashRemaining = state.dashCount;
    return true;
  }
  if (code === 49 && state.pendingLine && state.dashRemaining > 0) {
    const dash = parseNum(value) ?? 0;
    const dashes = [...(state.pendingLine.dashes ?? [])];
    dashes.push(dash);
    state.pendingLine.dashes = dashes;
    state.dashRemaining--;
    return true;
  }
  if (code === 75 || code === 76) return true;
  return false;
}

export function finishDxfHatchPatternParser(
  state: PatternParserState,
  patternName: string | null,
): DxfHatchPatternDef | null {
  flushPendingLine(state);
  if (state.lines.length === 0) return null;
  return {
    name: patternName,
    angleDeg: state.angleDeg,
    scale: state.scale,
    double: state.double,
    lines: state.lines,
  };
}

export function resolveImportedDxfHatchPattern(
  parsed: DxfHatchPatternDef | null,
  patternName: string | null,
  solidFill: boolean,
): DxfHatchPatternDef | null {
  if (solidFill) return null;
  if (parsed && parsed.lines.length > 0) return parsed;
  if (patternName) {
    const builtin = lookupBuiltinPatternLines(patternName);
    if (builtin) {
      return {
        name: patternName,
        angleDeg: parsed?.angleDeg ?? 0,
        scale: parsed?.scale ?? 1,
        double: parsed?.double ?? false,
        lines: builtin,
      };
    }
  }
  return parsed;
}

function rotateXY(x: number, y: number, angleRad: number): { x: number; y: number } {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function horizontalLinePolygonIntersections(poly: readonly { x: number; y: number }[], y: number): number[] {
  const xs: number[] = [];
  const n = poly.length;
  if (n < 3) return xs;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const dy = b.y - a.y;
    if (Math.abs(dy) < LW_EPS) continue;
    const yMin = Math.min(a.y, b.y);
    const yMax = Math.max(a.y, b.y);
    if (y < yMin || y >= yMax) continue;
    const t = (y - a.y) / dy;
    xs.push(a.x + t * (b.x - a.x));
  }
  xs.sort((a, b) => a - b);
  return xs;
}

function clipSolidParallelLinesToPolygon(
  vertices: readonly { x: number; y: number }[],
  lineAngleDeg: number,
  spacing: number,
  phaseY: number,
): DxfHatchPatternSegment[] {
  if (vertices.length < 3 || spacing <= LW_EPS) return [];
  const angleRad = (lineAngleDeg * Math.PI) / 180;
  const rotated = vertices.map((v) => rotateXY(v.x, v.y, -angleRad));
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of rotated) {
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }
  const segments: DxfHatchPatternSegment[] = [];
  const phase = ((phaseY % spacing) + spacing) % spacing;
  const yStart = Math.floor((minY - phase) / spacing) * spacing + phase;
  for (let y = yStart; y <= maxY + spacing * 0.5 && segments.length < MAX_PATTERN_LINES_PER_LOOP; y += spacing) {
    const xs = horizontalLinePolygonIntersections(rotated, y);
    for (let k = 0; k + 1 < xs.length && segments.length < MAX_PATTERN_LINES_PER_LOOP; k += 2) {
      const x1r = xs[k]!;
      const x2r = xs[k + 1]!;
      const a = rotateXY(x1r, y, angleRad);
      const b = rotateXY(x2r, y, angleRad);
      if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < 1e-12) continue;
      segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }
  return segments;
}

function expandPatternLines(def: DxfHatchPatternDef): DxfHatchPatternLineDef[] {
  const out: DxfHatchPatternLineDef[] = [...def.lines];
  if (def.double) {
    for (const line of def.lines) {
      out.push({ ...line, angleDeg: line.angleDeg + 90 });
    }
  }
  return out;
}

/**
 * Generate clipped LINE segments for a closed hatch boundary loop and resolved pattern definition.
 * Dashed `.pat` entries tessellate as short solid chords (MVP — no gap rendering).
 */
export function generateDxfHatchPatternLineSegments(
  vertices: readonly { x: number; y: number }[],
  pattern: DxfHatchPatternDef,
): DxfHatchPatternSegment[] {
  if (vertices.length < 3) return [];
  const lines = expandPatternLines(pattern);
  const segments: DxfHatchPatternSegment[] = [];
  for (const line of lines) {
    const spacing = Math.hypot(line.offsetX, line.offsetY) * pattern.scale;
    if (spacing <= LW_EPS) continue;
    const effectiveAngle = pattern.angleDeg + line.angleDeg;
    const baseRot = rotateXY(line.baseX, line.baseY, (-effectiveAngle * Math.PI) / 180);
    const phaseY = baseRot.y;
    const solidSegments = clipSolidParallelLinesToPolygon(vertices, effectiveAngle, spacing, phaseY);
    if (line.dashes.length === 0) {
      for (const seg of solidSegments) {
        if (segments.length >= MAX_PATTERN_LINES_PER_LOOP) return segments;
        segments.push(seg);
      }
      continue;
    }
    for (const seg of solidSegments) {
      if (segments.length >= MAX_PATTERN_LINES_PER_LOOP) return segments;
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const len = Math.hypot(dx, dy);
      if (len <= LW_EPS) continue;
      const ux = dx / len;
      const uy = dy / len;
      let pos = 0;
      let dashIdx = 0;
      let draw = true;
      while (pos < len - LW_EPS && segments.length < MAX_PATTERN_LINES_PER_LOOP) {
        const dashLen = Math.max(line.dashes[dashIdx % line.dashes.length] ?? 0, 0) * pattern.scale;
        dashIdx++;
        if (dashLen <= LW_EPS) {
          draw = !draw;
          continue;
        }
        const end = Math.min(pos + dashLen, len);
        if (draw) {
          segments.push({
            x1: seg.x1 + ux * pos,
            y1: seg.y1 + uy * pos,
            x2: seg.x1 + ux * end,
            y2: seg.y1 + uy * end,
          });
        }
        pos = end;
        draw = !draw;
      }
    }
  }
  return segments;
}

export { createPatternParserState, lookupBuiltinPatternLines, MAX_PATTERN_LINES_PER_LOOP };

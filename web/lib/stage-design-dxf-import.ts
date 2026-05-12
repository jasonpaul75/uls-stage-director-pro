import type { StageDesignShape } from "./stage-design-canvas";

import { expandVerticesWithBulges } from "./stage-design-dxf-bulge";
import { stripMinimalMtextMarkup } from "./stage-design-dxf-mtext";

export type ParsedDxfPair = { code: number; value: string };

/** Split ASCII DXF into code/value pairs (one pair per two lines). */
export function parseDxfAsciiPairs(text: string): ParsedDxfPair[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: ParsedDxfPair[] = [];
  for (let i = 0; i < lines.length; ) {
    const rawCode = lines[i++] ?? "";
    const ct = rawCode.trim();
    if (ct.length === 0) break;
    const val = lines[i++] ?? "";
    const code = Number(ct);
    if (!Number.isFinite(code)) break;
    out.push({ code, value: val });
  }
  return out;
}

function findEntitiesSectionStart(pairs: ParsedDxfPair[]): number {
  for (let i = 0; i < pairs.length - 1; i++) {
    const a = pairs[i]!;
    const b = pairs[i + 1]!;
    if (a.code === 0 && a.value === "SECTION" && b.code === 2 && b.value === "ENTITIES") {
      return i + 2;
    }
  }
  return -1;
}

/** Collect DXF group codes until the next entity boundary (`code === 0`). */
function consumeEntityFieldsAt(
  pairs: ParsedDxfPair[],
  start: number,
): { fields: Map<number, string>; next: number } {
  const fields = new Map<number, string>();
  let j = start;
  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;
    fields.set(p.code, p.value);
    j++;
  }
  return { fields, next: j };
}

function num(fields: Map<number, string>, code: number): number | undefined {
  const raw = fields.get(code);
  if (raw === undefined) return undefined;
  const v = Number(String(raw).trim());
  return Number.isFinite(v) ? v : undefined;
}

function mergeMultilineText(fields: Map<number, string>): string {
  const primary = fields.get(1)?.trim() ?? "";
  const extra = fields.get(3)?.trim() ?? "";
  return `${primary}${extra}`.trim();
}

const LW_POLY_EPS = 1e-9;

function dedupeConsecutiveVerticesXY(
  verts: readonly { x: number; y: number }[],
): { x: number; y: number }[] {
  const deduped: { x: number; y: number }[] = [];
  for (const v of verts) {
    const last = deduped[deduped.length - 1];
    if (
      last &&
      Math.abs(last.x - v.x) < LW_POLY_EPS &&
      Math.abs(last.y - v.y) < LW_POLY_EPS
    ) {
      continue;
    }
    deduped.push(v);
  }
  return deduped;
}

/** Dedupe consecutive XY points; if closedFlag (DXF polyline flag bit 1), append first point when closing segment is missing. */
function finalizeImportedPolyVertices(
  verts: readonly { x: number; y: number }[],
  closedFlag: boolean,
): { vertices: { x: number; y: number }[]; ok: boolean } {
  let out = dedupeConsecutiveVerticesXY(verts);
  if (closedFlag && out.length >= 3) {
    const f = out[0]!;
    const l = out[out.length - 1]!;
    if (Math.hypot(f.x - l.x, f.y - l.y) > LW_POLY_EPS) {
      out = [...out, { x: f.x, y: f.y }];
    }
  }
  return { vertices: out, ok: out.length >= 2 };
}

/** Advance from `j` (typically at a code-0 entity) to the pair index after the next SEQEND subgroup (or EOF). */
function skipPolylineTailToSeqEnd(pairs: ParsedDxfPair[], j: number): number {
  let k = j;
  while (k < pairs.length) {
    const p = pairs[k]!;
    if (p.code === 0 && p.value === "SEQEND") {
      return consumeEntityFieldsAt(pairs, k + 1).next;
    }
    k++;
  }
  return pairs.length;
}

/**
 * Scan ENTITIES subgroup for LWPOLYLINE (repeating codes 10/20 vertices; optional 42 bulge per outgoing segment).
 * Returns parsed vertices and index of the next code-0 entity opener (or EOF).
 */
function consumeLwPolylineVerticesAt(
  pairs: ParsedDxfPair[],
  start: number,
): { vertices: { x: number; y: number }[]; next: number; ok: boolean } {
  let j = start;
  let flags70 = 0;
  let pendingX: number | undefined;
  const verts: { x: number; y: number }[] = [];
  const bulges: number[] = [];

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;

    switch (p.code) {
      case 70:
        flags70 = Number(String(p.value).trim()) || 0;
        break;
      case 10: {
        const x = Number(String(p.value).trim());
        pendingX = Number.isFinite(x) ? x : undefined;
        break;
      }
      case 20: {
        if (pendingX !== undefined) {
          const y = Number(String(p.value).trim());
          if (Number.isFinite(y)) {
            verts.push({ x: pendingX, y });
            bulges.push(0);
          }
          pendingX = undefined;
        }
        break;
      }
      case 42: {
        const bv = Number(String(p.value).trim());
        if (verts.length > 0 && Number.isFinite(bv)) bulges[verts.length - 1] = bv;
        break;
      }
      default:
        break;
    }
    j++;
  }

  const closed = (flags70 & 1) !== 0;
  while (bulges.length < verts.length) bulges.push(0);
  const expanded = expandVerticesWithBulges(verts, bulges, closed);
  const fin = finalizeImportedPolyVertices(expanded, closed);
  return { vertices: fin.vertices, next: j, ok: fin.ok };
}

/** Classic POLYLINE header then VERTEX … VERTEX … SEQEND (bulge 42 on VERTEX tessellates arcs). */
function consumeOldPolylineVertexSeqAt(
  pairs: ParsedDxfPair[],
  headerBodyStart: number,
): { vertices: { x: number; y: number }[]; next: number; ok: boolean } {
  const header = consumeEntityFieldsAt(pairs, headerBodyStart);
  const flags70 = Number(String(header.fields.get(70) ?? "0").trim()) || 0;
  const closed = (flags70 & 1) !== 0;
  const verts: { x: number; y: number }[] = [];
  const bulges: number[] = [];
  let j = header.next;

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code !== 0) {
      j++;
      continue;
    }
    if (p.value === "SEQEND") {
      j = consumeEntityFieldsAt(pairs, j + 1).next;
      break;
    }
    if (p.value === "VERTEX") {
      const vf = consumeEntityFieldsAt(pairs, j + 1);
      j = vf.next;
      const x = num(vf.fields, 10);
      const y = num(vf.fields, 20);
      const b = num(vf.fields, 42) ?? 0;
      if (x !== undefined && y !== undefined && Number.isFinite(x * y)) {
        verts.push({ x, y });
        bulges.push(Number.isFinite(b) ? b : 0);
      }
      continue;
    }
    j = skipPolylineTailToSeqEnd(pairs, j);
    break;
  }

  while (bulges.length < verts.length) bulges.push(0);
  const expanded = expandVerticesWithBulges(verts, bulges, closed);
  const fin = finalizeImportedPolyVertices(expanded, closed);
  return { vertices: fin.vertices, next: j, ok: fin.ok };
}

function consumeMtextEntityAt(
  pairs: ParsedDxfPair[],
  start: number,
): { x?: number; y?: number; rotRad?: number; rawText: string; next: number } {
  let j = start;
  const chunks: string[] = [];
  let x: number | undefined;
  let y: number | undefined;
  let rotRad: number | undefined;
  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;
    switch (p.code) {
      case 1:
      case 3:
        chunks.push(p.value);
        break;
      case 10: {
        const v = Number(String(p.value).trim());
        if (Number.isFinite(v)) x = v;
        break;
      }
      case 20: {
        const v = Number(String(p.value).trim());
        if (Number.isFinite(v)) y = v;
        break;
      }
      case 50: {
        const v = Number(String(p.value).trim());
        if (Number.isFinite(v)) rotRad = v;
        break;
      }
      default:
        break;
    }
    j++;
  }
  return { x, y, rotRad, rawText: chunks.join(""), next: j };
}

export type MinimalAsciiDxfImportOk = {
  ok: true;
  shapes: Omit<StageDesignShape, "id">[];
  skippedAfterCap: number;
  skippedDegenerate: number;
  skippedUnsupportedEntities: number;
};

export type MinimalAsciiDxfImportFail = { ok: false; error: string };

export type MinimalAsciiDxfImportResult = MinimalAsciiDxfImportOk | MinimalAsciiDxfImportFail;

/**
 * Parse minimal ASCII DXF (LINE, CIRCLE, TEXT, MTEXT, LWPOLYLINE, POLYLINE/VERTEX/SEQEND) from ENTITIES into diagram shapes.
 * Coordinates match diagram linear units (feet / meters) — same convention as {@link buildStageDesignDxf}.
 * Polyline entities map to POLYLINE shapes (DXF bulge 42 arcs tessellated to vertices).
 * MTEXT maps to TEXT after normalizing markup (paragraph/tabs/fields — see stripMinimalMtextMarkup).
 * Ignores layers and Z where XY geometry suffices.
 * Callers assign id, layerId, and run clampShape.
 */
export function importMinimalAsciiDxfEntities(text: string, opts: { maxShapes: number }): MinimalAsciiDxfImportResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, error: "DXF file is empty." };

  const pairs = parseDxfAsciiPairs(trimmed);
  if (pairs.length < 8) return { ok: false, error: "DXF file is too short to parse." };

  let i = findEntitiesSectionStart(pairs);
  if (i < 0) {
    /** Some exporters omit SECTION wrappers — scan for ENTITIES sentinel only. */
    const idx = pairs.findIndex((p) => p.code === 2 && p.value === "ENTITIES");
    i = idx >= 0 ? idx + 1 : -1;
  }
  if (i < 0)
    return { ok: false, error: "No ENTITIES section found (expects ASCII DXF with diagram entities)." };

  const shapes: Omit<StageDesignShape, "id">[] = [];
  let skippedDegenerate = 0;
  let skippedUnsupportedEntities = 0;
  let skippedAfterCap = 0;

  while (i < pairs.length) {
    const ent = pairs[i]!;
    if (ent.code === 0 && ent.value === "ENDSEC") break;
    if (ent.code !== 0) {
      i++;
      continue;
    }
    const typ = ent.value;
    i++;

    if (typ === "LWPOLYLINE") {
      const lw = consumeLwPolylineVerticesAt(pairs, i);
      i = lw.next;
      if (shapes.length >= opts.maxShapes) {
        skippedAfterCap++;
        continue;
      }
      if (!lw.ok) {
        skippedDegenerate++;
        continue;
      }
      const v0 = lw.vertices[0]!;
      shapes.push({
        kind: "POLYLINE",
        x: v0.x,
        y: v0.y,
        rotationDeg: 0,
        vertices: lw.vertices.map((p) => ({ x: p.x, y: p.y })),
      });
      continue;
    }

    if (typ === "POLYLINE") {
      const poly = consumeOldPolylineVertexSeqAt(pairs, i);
      i = poly.next;
      if (shapes.length >= opts.maxShapes) {
        skippedAfterCap++;
        continue;
      }
      if (!poly.ok) {
        skippedDegenerate++;
        continue;
      }
      const v0 = poly.vertices[0]!;
      shapes.push({
        kind: "POLYLINE",
        x: v0.x,
        y: v0.y,
        rotationDeg: 0,
        vertices: poly.vertices.map((p) => ({ x: p.x, y: p.y })),
      });
      continue;
    }

    if (typ === "MTEXT") {
      const mt = consumeMtextEntityAt(pairs, i);
      i = mt.next;
      if (shapes.length >= opts.maxShapes) {
        skippedAfterCap++;
        continue;
      }
      const label = stripMinimalMtextMarkup(mt.rawText).slice(0, 400);
      const x = mt.x;
      const y = mt.y;
      if (x === undefined || y === undefined || !Number.isFinite(x * y) || label.length === 0) {
        skippedDegenerate++;
        continue;
      }
      const rotRad = mt.rotRad;
      const rotationDegRaw =
        rotRad !== undefined && Number.isFinite(rotRad) ? (rotRad * 180) / Math.PI : 0;
      const rotationDeg = Math.round(rotationDegRaw * 10_000) / 10_000;
      shapes.push({
        kind: "TEXT",
        x,
        y,
        label,
        rotationDeg,
      });
      continue;
    }

    const { fields, next } = consumeEntityFieldsAt(pairs, i);

    if (shapes.length >= opts.maxShapes) {
      if (typ !== "ENDSEC") skippedAfterCap++;
      i = next;
      continue;
    }

    switch (typ) {
      case "LINE": {
        const x1 = num(fields, 10);
        const y1 = num(fields, 20);
        const x2 = num(fields, 11);
        const y2 = num(fields, 21);
        if (
          x1 === undefined ||
          y1 === undefined ||
          x2 === undefined ||
          y2 === undefined ||
          !Number.isFinite(x1 * y1 * x2 * y2)
        ) {
          skippedDegenerate++;
          break;
        }
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (dx * dx + dy * dy < 1e-12) {
          skippedDegenerate++;
          break;
        }
        shapes.push({
          kind: "LINE",
          x: x1,
          y: y1,
          x2,
          y2,
          rotationDeg: 0,
        });
        break;
      }
      case "CIRCLE": {
        const cx = num(fields, 10);
        const cy = num(fields, 20);
        const r = num(fields, 40);
        if (cx === undefined || cy === undefined || r === undefined || !Number.isFinite(cx * cy * r) || r <= 1e-9) {
          skippedDegenerate++;
          break;
        }
        shapes.push({
          kind: "ELLIPSE",
          x: cx,
          y: cy,
          width: r,
          height: r,
          rotationDeg: 0,
        });
        break;
      }
      case "TEXT": {
        const x = num(fields, 10);
        const y = num(fields, 20);
        const rotRad = num(fields, 50);
        const labelRaw = mergeMultilineText(fields);
        const label = labelRaw.slice(0, 400);
        if (x === undefined || y === undefined || !Number.isFinite(x * y) || label.length === 0) {
          skippedDegenerate++;
          break;
        }
        const rotationDegRaw =
          rotRad !== undefined && Number.isFinite(rotRad) ? (rotRad * 180) / Math.PI : 0;
        const rotationDeg = Math.round(rotationDegRaw * 10_000) / 10_000;
        shapes.push({
          kind: "TEXT",
          x,
          y,
          label,
          rotationDeg,
        });
        break;
      }
      default:
        skippedUnsupportedEntities++;
        break;
    }

    i = next;
  }

  return {
    ok: true,
    shapes,
    skippedAfterCap,
    skippedDegenerate,
    skippedUnsupportedEntities,
  };
}

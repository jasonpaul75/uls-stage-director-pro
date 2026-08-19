import type { DxfBinaryPair } from "./stage-design-dxf-binary";
import { dxfFaceCornersFromFields } from "./stage-design-dxf-vendor-entities";

export type DxfFieldMap = ReadonlyMap<number, string>;

export const DXF_CONSTRUCTION_LINE_HALF_LENGTH = 500;

function parseFieldNum(fields: DxfFieldMap, code: number): number | undefined {
  const raw = fields.get(code);
  if (raw === undefined) return undefined;
  const v = Number(String(raw).trim());
  return Number.isFinite(v) ? v : undefined;
}

function parseNum(raw: string): number | undefined {
  const v = Number(String(raw).trim());
  return Number.isFinite(v) ? v : undefined;
}

export type DxfVertexChainEntity = {
  vertices: { x: number; y: number }[];
  fields: Map<number, string>;
  mtext304: string[];
  next: number;
};

/** Collect repeating 10/20 vertices plus scalar fields (LEADER / MLEADER / WIPEOUT clip paths). */
export function consumeDxfVertexChainEntityAt(
  pairs: readonly DxfBinaryPair[],
  start: number,
  opts?: { capture304?: boolean },
): DxfVertexChainEntity {
  let j = start;
  let pendingX: number | undefined;
  const vertices: { x: number; y: number }[] = [];
  const fields = new Map<number, string>();
  const mtext304: string[] = [];

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;
    if (p.code === 10) {
      pendingX = parseNum(p.value);
    } else if (p.code === 20) {
      if (pendingX !== undefined) {
        const y = parseNum(p.value);
        if (y !== undefined) vertices.push({ x: pendingX, y });
        pendingX = undefined;
      }
    } else if (opts?.capture304 && p.code === 304) {
      const t = p.value.trim();
      if (t.length > 0) mtext304.push(t);
    } else if (p.code !== 10 && p.code !== 20) {
      fields.set(p.code, p.value);
    }
    j++;
  }

  return { vertices, fields, mtext304, next: j };
}

export function dxfAnnotationLabelFromEntity(fields: DxfFieldMap, mtext304: readonly string[]): string {
  const from304 = mtext304.find((t) => t.trim().length > 0)?.trim();
  if (from304) return from304.slice(0, 400);
  const from1 = fields.get(1)?.trim();
  if (from1) return from1.slice(0, 400);
  const from3 = fields.get(3)?.trim();
  if (from3) return from3.slice(0, 400);
  return "";
}

export function dxfAnnotationTextPositionFromEntity(
  fields: DxfFieldMap,
  vertices: readonly { x: number; y: number }[],
): { x: number; y: number } | null {
  const x = parseFieldNum(fields, 11) ?? parseFieldNum(fields, 212) ?? parseFieldNum(fields, 10);
  const y = parseFieldNum(fields, 21) ?? parseFieldNum(fields, 222) ?? parseFieldNum(fields, 20);
  if (x !== undefined && y !== undefined && Number.isFinite(x * y)) return { x, y };
  const last = vertices.at(-1);
  return last ?? null;
}

export function dxfAnnotationRotationDegFromFields(fields: DxfFieldMap): number {
  const rotRad = parseFieldNum(fields, 50);
  if (rotRad === undefined || !Number.isFinite(rotRad)) return 0;
  return Math.round(((rotRad * 180) / Math.PI) * 10_000) / 10_000;
}

/** RAY / XLINE → finite LINE segment for diagram import (clipped length). */
export function dxfConstructionLineSegmentFromFields(
  fields: DxfFieldMap,
  bidirectional: boolean,
  halfLength = DXF_CONSTRUCTION_LINE_HALF_LENGTH,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const x0 = parseFieldNum(fields, 10);
  const y0 = parseFieldNum(fields, 20);
  const dx = parseFieldNum(fields, 11);
  const dy = parseFieldNum(fields, 21);
  if (x0 === undefined || y0 === undefined || dx === undefined || dy === undefined) return null;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-12) return null;
  const ux = dx / len;
  const uy = dy / len;
  const span = Math.max(halfLength, 1);
  if (bidirectional) {
    return {
      x1: x0 - ux * span,
      y1: y0 - uy * span,
      x2: x0 + ux * span,
      y2: y0 + uy * span,
    };
  }
  return {
    x1: x0,
    y1: y0,
    x2: x0 + ux * span,
    y2: y0 + uy * span,
  };
}

/** WIPEOUT clip boundary from vertex chain or UV parallelogram at insertion point. */
export function dxfWipeoutCornersFromEntity(
  fields: DxfFieldMap,
  vertices: readonly { x: number; y: number }[],
): { x: number; y: number }[] {
  if (vertices.length >= 3) return [...vertices];
  const x0 = parseFieldNum(fields, 10);
  const y0 = parseFieldNum(fields, 20);
  const ux = parseFieldNum(fields, 11);
  const uy = parseFieldNum(fields, 21);
  const vx = parseFieldNum(fields, 12);
  const vy = parseFieldNum(fields, 22);
  if (
    x0 !== undefined &&
    y0 !== undefined &&
    ux !== undefined &&
    uy !== undefined &&
    vx !== undefined &&
    vy !== undefined
  ) {
    return [
      { x: x0, y: y0 },
      { x: x0 + ux, y: y0 + uy },
      { x: x0 + ux + vx, y: y0 + uy + vy },
      { x: x0 + vx, y: y0 + vy },
    ];
  }
  return dxfFaceCornersFromFields(fields);
}

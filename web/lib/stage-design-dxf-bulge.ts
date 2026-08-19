/** Ignore tiny bulges — chord is visually straight. */
export const DXF_BULGE_EPS = 1e-12;

/** DXF bulge = tan(included_angle / 4); sign is CCW vs CW from segment start → end. */
export function bulgeFromIncludedAngleRad(includedAngleRad: number): number {
  return Math.tan(includedAngleRad / 4);
}

/**
 * Tessellate one DXF chord **P1→P2** with optional bulge **b** (`tan(included_angle / 4)`).
 * Returns ordered vertices **including** **P1** and **P2** (straight segment when bulge ≈ 0).
 */
export function tessellateBulgeChordInclusive(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bulge: number,
  maxInteriorSegments = 16,
): { x: number; y: number }[] {
  if (!Number.isFinite(bulge) || Math.abs(bulge) < DXF_BULGE_EPS) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }

  const thetaFull = 4 * Math.atan(bulge);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const chordLen = Math.hypot(dx, dy);
  if (chordLen < 1e-14) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }

  const sinHalf = Math.sin(Math.abs(thetaFull) / 2);
  if (Math.abs(sinHalf) < 1e-14) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }

  const R = chordLen / (2 * sinHalf);
  const nx = -dy / chordLen;
  const ny = dx / chordLen;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const h = R * Math.cos(Math.abs(thetaFull) / 2);
  const cx = mx + nx * Math.sign(bulge) * h;
  const cy = my + ny * Math.sign(bulge) * h;

  const a1 = Math.atan2(y1 - cy, x1 - cx);
  let sweep = thetaFull;
  let bestErr = Infinity;
  for (let k = -4; k <= 4; k++) {
    const cand = thetaFull + k * 2 * Math.PI;
    const xe = cx + R * Math.cos(a1 + cand);
    const ye = cy + R * Math.sin(a1 + cand);
    const err = Math.hypot(xe - x2, ye - y2);
    const tieBetter =
      err < bestErr - 1e-12 ||
      (Math.abs(err - bestErr) <= 1e-12 && Math.abs(cand - thetaFull) < Math.abs(sweep - thetaFull));
    if (tieBetter) {
      bestErr = err;
      sweep = cand;
    }
  }

  const steps = Math.max(
    2,
    Math.min(maxInteriorSegments, Math.ceil(Math.abs(sweep) / (Math.PI / 24))),
  );

  const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const ang = a1 + sweep * t;
    pts.push({ x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) });
  }
  pts[pts.length - 1] = { x: x2, y: y2 };
  return pts;
}

/**
 * Expand polyline vertices using DXF-style outgoing bulges: `bulgesOut[i]` applies from vertex **i** to **i+1**
 * (wrap **i = n−1 → 0** when `closed`).
 */
export function expandVerticesWithBulges(
  verts: readonly { x: number; y: number }[],
  bulgesOut: readonly number[],
  closed: boolean,
): { x: number; y: number }[] {
  const n = verts.length;
  if (n < 2) return verts.slice();
  const segCount = closed ? n : n - 1;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % n;
    const x1 = verts[i]!.x;
    const y1 = verts[i]!.y;
    const x2 = verts[j]!.x;
    const y2 = verts[j]!.y;
    const b = bulgesOut[i] ?? 0;
    const chunk = tessellateBulgeChordInclusive(x1, y1, x2, y2, b);
    if (out.length === 0) out.push(...chunk);
    else out.push(...chunk.slice(1));
  }
  return out;
}

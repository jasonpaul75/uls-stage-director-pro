/** DXF classic POLYLINE flag 70: polygon mesh (M×N grid). */
export const DXF_POLYLINE_FLAG_POLYGON_MESH = 64;

/** DXF classic POLYLINE flag 70: polyface mesh (coordinate + face-record VERTEX entities). */
export const DXF_POLYLINE_FLAG_POLYFACE_MESH = 128;

/** DXF VERTEX flag 70 bit 7: face record referencing coordinate vertices by index. */
export const DXF_VERTEX_FLAG_FACE_RECORD = 128;

function parseNum(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const v = Number(String(raw).trim());
  return Number.isFinite(v) ? v : undefined;
}

/** Read 1-based face vertex indices from codes 71–74 (negative = invisible edge, not index sign). */
export function faceIndicesFromVertexFields(fields: Map<number, string>): number[] {
  const indices: number[] = [];
  for (const code of [71, 72, 73, 74] as const) {
    const v = parseNum(fields.get(code));
    if (v !== undefined && v !== 0) indices.push(Math.abs(Math.trunc(v)));
  }
  if (indices.length === 3) indices.push(indices[2]!);
  return indices;
}

const MESH_EPS = 1e-9;

/** Resolve polyface face index groups into closed boundary loops (diagram XY). */
export function resolvePolyfaceMeshLoops(
  meshVertices: readonly { x: number; y: number }[],
  faceIndexGroups: readonly number[][],
): { x: number; y: number }[][] {
  const loops: { x: number; y: number }[][] = [];
  for (const face of faceIndexGroups) {
    const pts: { x: number; y: number }[] = [];
    for (const oneBased of face) {
      const idx = oneBased - 1;
      if (idx < 0 || idx >= meshVertices.length) continue;
      const p = meshVertices[idx]!;
      const last = pts[pts.length - 1];
      if (last && Math.hypot(last.x - p.x, last.y - p.y) < MESH_EPS) continue;
      pts.push(p);
    }
    if (pts.length >= 3) loops.push(pts);
  }
  return loops;
}

/** Build quad face loops from an M×N polygon-mesh vertex grid (row-major, codes 71/72 on POLYLINE header). */
export function polygonMeshGridLoops(
  rows: number,
  cols: number,
  vertices: readonly { x: number; y: number }[],
): { x: number; y: number }[][] {
  const m = Math.max(2, Math.floor(rows) || 2);
  const n = Math.max(2, Math.floor(cols) || 2);
  if (vertices.length < m * n) return [];

  const loops: { x: number; y: number }[][] = [];
  for (let r = 0; r < m - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const i00 = r * n + c;
      const i10 = (r + 1) * n + c;
      const i11 = (r + 1) * n + (c + 1);
      const i01 = r * n + (c + 1);
      const p00 = vertices[i00];
      const p10 = vertices[i10];
      const p11 = vertices[i11];
      const p01 = vertices[i01];
      if (!p00 || !p10 || !p11 || !p01) continue;
      loops.push([p00, p10, p11, p01]);
    }
  }
  return loops;
}

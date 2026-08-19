/** Vendor CAD face primitives (SOLID / TRACE / 3DFACE) and DIMENSION text helpers. */

export type DxfFieldMap = ReadonlyMap<number, string>;

function parseFieldNum(fields: DxfFieldMap, code: number): number | undefined {
  const raw = fields.get(code);
  if (raw === undefined) return undefined;
  const v = Number(String(raw).trim());
  return Number.isFinite(v) ? v : undefined;
}

const FACE_CORNER_CODES: readonly (readonly [number, number])[] = [
  [10, 20],
  [11, 21],
  [12, 22],
  [13, 23],
];

const LW_EPS = 1e-9;

/** XY corners for SOLID / TRACE / 3DFACE (drops duplicate triangle closing corner). */
export function dxfFaceCornersFromFields(fields: DxfFieldMap): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [];
  for (const [xc, yc] of FACE_CORNER_CODES) {
    const x = parseFieldNum(fields, xc);
    const y = parseFieldNum(fields, yc);
    if (x === undefined || y === undefined || !Number.isFinite(x * y)) continue;
    const last = corners[corners.length - 1];
    if (last && Math.abs(last.x - x) < LW_EPS && Math.abs(last.y - y) < LW_EPS) continue;
    corners.push({ x, y });
  }
  if (corners.length >= 2) {
    const first = corners[0]!;
    const last = corners[corners.length - 1]!;
    if (corners.length >= 3 && Math.abs(first.x - last.x) < LW_EPS && Math.abs(first.y - last.y) < LW_EPS) {
      corners.pop();
    }
  }
  return corners;
}

export type DxfDimensionTextImport = {
  label: string;
  x: number;
  y: number;
  rotationDeg: number;
};

/** Best-effort DIMENSION → diagram TEXT (override on code 1, midpoint on 11/21). */
export function dxfDimensionTextFromFields(fields: DxfFieldMap): DxfDimensionTextImport | null {
  const label = (fields.get(1) ?? fields.get(3) ?? "").trim();
  if (label.length === 0) return null;
  const x = parseFieldNum(fields, 11) ?? parseFieldNum(fields, 10);
  const y = parseFieldNum(fields, 21) ?? parseFieldNum(fields, 20);
  if (x === undefined || y === undefined || !Number.isFinite(x * y)) return null;
  const rotRad = parseFieldNum(fields, 50);
  const rotationDeg =
    rotRad !== undefined && Number.isFinite(rotRad) ? Math.round(((rotRad * 180) / Math.PI) * 10_000) / 10_000 : 0;
  return { label: label.slice(0, 400), x, y, rotationDeg };
}

import type { StageDesignShape } from "./stage-design-canvas";

export type DxfPair = { code: number; value: string };

export type DxfInsertTransform = {
  ix: number;
  iy: number;
  sx: number;
  sy: number;
  rotDeg: number;
};

export type DxfBlockDef = {
  name: string;
  baseX: number;
  baseY: number;
  /** First entity opener (`code === 0`) inside the block. */
  entityStart: number;
  /** Index of `ENDBLK` opener (exclusive end for entity scan). */
  entityEnd: number;
};

function numField(fields: Map<number, string>, code: number): number | undefined {
  const raw = fields.get(code);
  if (raw === undefined) return undefined;
  const v = Number(String(raw).trim());
  return Number.isFinite(v) ? v : undefined;
}

/** Collect DXF group codes until the next entity boundary (`code === 0`). */
function consumeEntityFieldsAt(
  pairs: readonly DxfPair[],
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

function findSectionContentEnd(pairs: readonly DxfPair[], sectionStart: number): number {
  for (let j = sectionStart; j < pairs.length; j++) {
    const p = pairs[j]!;
    if (p.code === 0 && p.value === "ENDSEC") return j;
  }
  return pairs.length;
}

/** Locate `SECTION` / `2` / `name` content start (index after section header pairs). */
export function findDxfSectionContentStart(pairs: readonly DxfPair[], sectionName: string): number {
  for (let i = 0; i < pairs.length - 1; i++) {
    const a = pairs[i]!;
    const b = pairs[i + 1]!;
    if (a.code === 0 && a.value === "SECTION" && b.code === 2 && b.value === sectionName) {
      return i + 2;
    }
  }
  return -1;
}

/** Parse BLOCK … ENDBLK definitions from a DXF pair stream (names compared case-insensitively). */
export function parseDxfBlockCatalog(pairs: readonly DxfPair[]): Map<string, DxfBlockDef> {
  const catalog = new Map<string, DxfBlockDef>();
  const blocksStart = findDxfSectionContentStart(pairs, "BLOCKS");
  if (blocksStart < 0) return catalog;

  const blocksEnd = findSectionContentEnd(pairs, blocksStart);
  let i = blocksStart;

  while (i < blocksEnd) {
    const ent = pairs[i]!;
    if (ent.code !== 0) {
      i++;
      continue;
    }
    if (ent.value !== "BLOCK") {
      i++;
      continue;
    }

    i++;
    const header = consumeEntityFieldsAt(pairs, i);
    i = header.next;
    const name = header.fields.get(2)?.trim();
    if (!name) continue;

    const baseX = numField(header.fields, 10) ?? 0;
    const baseY = numField(header.fields, 20) ?? 0;
    const entityStart = i;

    while (i < blocksEnd) {
      const p = pairs[i]!;
      if (p.code === 0 && (p.value === "ENDBLK" || p.value === "BLOCK")) break;
      i++;
    }

    const entityEnd = i;
    catalog.set(name.toUpperCase(), { name, baseX, baseY, entityStart, entityEnd });

    if (i < blocksEnd && pairs[i]!.code === 0 && pairs[i]!.value === "ENDBLK") {
      i = consumeEntityFieldsAt(pairs, i + 1).next;
    }
  }

  return catalog;
}

export function transformBlockLocalXY(
  x: number,
  y: number,
  blockBaseX: number,
  blockBaseY: number,
  insert: DxfInsertTransform,
): { x: number; y: number } {
  const lx = (x - blockBaseX) * insert.sx;
  const ly = (y - blockBaseY) * insert.sy;
  const r = (insert.rotDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    x: insert.ix + cos * lx - sin * ly,
    y: insert.iy + sin * lx + cos * ly,
  };
}

/** Apply block INSERT transform to an imported diagram shape (block-local → world). */
export function transformImportedShapeForBlockInsert(
  shape: Omit<StageDesignShape, "id">,
  blockBaseX: number,
  blockBaseY: number,
  insert: DxfInsertTransform,
): Omit<StageDesignShape, "id"> {
  const pt = (x: number, y: number) => transformBlockLocalXY(x, y, blockBaseX, blockBaseY, insert);
  const sx = Math.abs(insert.sx);
  const sy = Math.abs(insert.sy);

  switch (shape.kind) {
    case "LINE": {
      const a = pt(shape.x, shape.y);
      const b = pt(shape.x2 ?? shape.x, shape.y2 ?? shape.y);
      return { ...shape, x: a.x, y: a.y, x2: b.x, y2: b.y };
    }
    case "POLYLINE": {
      const vertices = (shape.vertices ?? [{ x: shape.x, y: shape.y }]).map((v) => pt(v.x, v.y));
      const v0 = vertices[0]!;
      return { ...shape, x: v0.x, y: v0.y, vertices };
    }
    case "ELLIPSE": {
      const c = pt(shape.x, shape.y);
      return {
        ...shape,
        x: c.x,
        y: c.y,
        width: (shape.width ?? 0) * sx,
        height: (shape.height ?? 0) * sy,
        rotationDeg: (shape.rotationDeg ?? 0) + insert.rotDeg,
      };
    }
    case "TEXT": {
      const c = pt(shape.x, shape.y);
      return {
        ...shape,
        x: c.x,
        y: c.y,
        rotationDeg: (shape.rotationDeg ?? 0) + insert.rotDeg,
      };
    }
    default:
      return shape;
  }
}

export function dxfInsertTransformFromFields(fields: Map<number, string>): DxfInsertTransform | null {
  const ix = numField(fields, 10);
  const iy = numField(fields, 20);
  if (ix === undefined || iy === undefined || !Number.isFinite(ix) || !Number.isFinite(iy)) return null;
  const sx = numField(fields, 41) ?? 1;
  const sy = numField(fields, 42) ?? 1;
  const rotDeg = numField(fields, 50) ?? 0;
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx === 0 || sy === 0) return null;
  return { ix, iy, sx, sy, rotDeg };
}

export type DxfInsertParsed = {
  blockName: string;
  instances: DxfInsertTransform[];
  next: number;
};

const INSERT_ARRAY_MAX_DIM = 64;
const INSERT_ARRAY_MAX_INSTANCES = 256;

function rotateInsertOffset(dx: number, dy: number, rotDeg: number): { dx: number; dy: number } {
  if (rotDeg === 0) return { dx, dy };
  const r = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { dx: dx * cos - dy * sin, dy: dx * sin + dy * cos };
}

/** Build world INSERT points for column/row array copies (spacing rotated by insert angle). */
export function buildDxfInsertInstanceTransforms(
  base: DxfInsertTransform,
  colCount: number,
  rowCount: number,
  colSpX: number,
  colSpY: number,
  rowSpX: number,
  rowSpY: number,
): DxfInsertTransform[] {
  const cols = Math.max(1, Math.min(INSERT_ARRAY_MAX_DIM, Math.floor(colCount) || 1));
  const rows = Math.max(1, Math.min(INSERT_ARRAY_MAX_DIM, Math.floor(rowCount) || 1));
  if (cols === 1 && rows === 1) return [base];

  const out: DxfInsertTransform[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cOff = rotateInsertOffset(colSpX * col, colSpY * col, base.rotDeg);
      const rOff = rotateInsertOffset(rowSpX * row, rowSpY * row, base.rotDeg);
      out.push({
        ix: base.ix + cOff.dx + rOff.dx,
        iy: base.iy + cOff.dy + rOff.dy,
        sx: base.sx,
        sy: base.sy,
        rotDeg: base.rotDeg,
      });
      if (out.length >= INSERT_ARRAY_MAX_INSTANCES) return out;
    }
  }
  return out;
}

/**
 * Parse INSERT entity fields in-order (array spacing reuses group codes 10/20 after counts 70/71).
 */
export function parseDxfInsertEntityAt(pairs: readonly DxfPair[], start: number): DxfInsertParsed | null {
  let j = start;
  let blockName = "";
  let ix: number | undefined;
  let iy: number | undefined;
  let sx = 1;
  let sy = 1;
  let rotDeg = 0;
  let colCount = 1;
  let rowCount = 1;
  let colSpX = 0;
  let colSpY = 0;
  let rowSpX = 0;
  let rowSpY = 0;
  let gotInsertPoint = false;
  let gotArrayCounts = false;
  let gotColSpacing = false;

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;
    const raw = String(p.value).trim();
    const v = Number(raw);
    const finite = Number.isFinite(v) ? v : undefined;
    switch (p.code) {
      case 2:
        blockName = p.value.trim();
        break;
      case 10:
        if (!gotInsertPoint) ix = finite;
        else if (gotArrayCounts && !gotColSpacing) colSpX = finite ?? 0;
        break;
      case 20:
        if (!gotInsertPoint) {
          iy = finite;
          if (ix !== undefined && iy !== undefined) gotInsertPoint = true;
        } else if (gotArrayCounts && !gotColSpacing) {
          colSpY = finite ?? 0;
          gotColSpacing = true;
        }
        break;
      case 30:
        if (gotArrayCounts && !gotColSpacing) gotColSpacing = true;
        break;
      case 41:
        if (finite !== undefined) sx = finite;
        gotInsertPoint = true;
        break;
      case 42:
        if (finite !== undefined) sy = finite;
        break;
      case 50:
        if (finite !== undefined) rotDeg = finite;
        break;
      case 70:
        if (finite !== undefined) colCount = finite;
        gotArrayCounts = true;
        break;
      case 71:
        if (finite !== undefined) rowCount = finite;
        gotArrayCounts = true;
        break;
      case 11:
        if (gotColSpacing) rowSpX = finite ?? 0;
        break;
      case 21:
        if (gotColSpacing) rowSpY = finite ?? 0;
        break;
      default:
        break;
    }
    j++;
  }

  if (!blockName || ix === undefined || iy === undefined) return null;
  if (!Number.isFinite(ix) || !Number.isFinite(iy) || sx === 0 || sy === 0) return null;

  const base: DxfInsertTransform = { ix, iy, sx, sy, rotDeg };
  const instances = buildDxfInsertInstanceTransforms(
    base,
    colCount,
    rowCount,
    colSpX,
    colSpY,
    rowSpX,
    rowSpY,
  );

  return { blockName, instances, next: j };
}

export type DxfAttribParsed = {
  label: string;
  x: number;
  y: number;
  rotationDeg: number;
  visible: boolean;
};

/** Parse one ATTRIB entity (value on code 1, insertion 10/20, visibility 60). */
export function parseDxfAttribEntityAt(
  pairs: readonly DxfPair[],
  start: number,
): { attrib: DxfAttribParsed | null; next: number } {
  const { fields, next } = consumeEntityFieldsAt(pairs, start);
  const label = (fields.get(1) ?? "").trim();
  const x = numField(fields, 10);
  const y = numField(fields, 20);
  const rotDeg = numField(fields, 50) ?? 0;
  const vis = numField(fields, 60);
  const visible = vis === undefined || vis === 0;
  if (!label || x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
    return { attrib: null, next };
  }
  return {
    attrib: {
      label,
      x,
      y,
      rotationDeg: Math.round(rotDeg * 10_000) / 10_000,
      visible,
    },
    next,
  };
}

/** Collect visible ATTRIB entities (and optional SEQEND) following an INSERT. */
export function consumeDxfInsertAttribFollowersAt(
  pairs: readonly DxfPair[],
  start: number,
): { attribs: DxfAttribParsed[]; next: number } {
  let j = start;
  const attribs: DxfAttribParsed[] = [];
  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code !== 0) {
      j++;
      continue;
    }
    if (p.value === "ATTRIB") {
      const parsed = parseDxfAttribEntityAt(pairs, j + 1);
      j = parsed.next;
      if (parsed.attrib?.visible) attribs.push(parsed.attrib);
      continue;
    }
    if (p.value === "SEQEND") {
      return { attribs, next: consumeEntityFieldsAt(pairs, j + 1).next };
    }
    break;
  }
  return { attribs, next: j };
}

/** Skip ATTRIB entities and optional SEQEND following an INSERT. */
export function skipDxfAttribFollowersAt(pairs: readonly DxfPair[], start: number): number {
  return consumeDxfInsertAttribFollowersAt(pairs, start).next;
}

import type {
  StageDeckPolygon,
  StageDesignCanvas,
  StageDiagramPaintRef,
} from "./stage-design-canvas";
import { repairDiagramPaintOrder, SYNTHETIC_DECK_RECT_POLYGON_ID } from "./stage-design-canvas";

/** Built-in bottom layer (JSON may omit per-entity `layerId` to mean this). */
export const DIAGRAM_LAYER_DEFAULT_ID = "__uls_layer_default";

export const MAX_DIAGRAM_LAYERS = 32;

export const MAX_DIAGRAM_LAYER_JSON_CHARS = 48_000;

/** Optional folder label (producer UI grouping only; contiguous stack order forms one collapsible folder). */
export const MAX_DIAGRAM_LAYER_GROUP_CHARS = 32;

export type StageDiagramLayer = {
  id: string;
  name: string;
  /**
   * Optional producer-only folder cue: adjacent custom tiers whose paths share a nonempty prefix are nested under
   * collapsible folders. Use **`/`** between segments for hierarchy (e.g. **`Rigging / LX`**). Contiguous flat labels
   * (no slash) still merge as a single folder like before. Does not alter paint/export beyond layer stack order.
   */
  group?: string;
  /** Omit or true = draw; false = hide entire layer in producer and Show. */
  visible?: boolean;
  /** When **true**, `[`/`]`/`Home`/`End` draw-order nudges are disabled inside this authoring tier (`diagramLayers` ordering still moves the whole tier). Forward-compatible JSON blob. */
  bracketReorderLocked?: boolean;
};

/** Sanitize optional folder label persisted on `{@link StageDiagramLayer}` rows. */
export function sanitizeDiagramLayerGroup(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().slice(0, MAX_DIAGRAM_LAYER_GROUP_CHARS);
  if (t.length === 0) return undefined;
  if (/[\u0000-\u001f]/.test(t)) return undefined;
  return t;
}

/** Sanitize persisted `layerId` from entities; invalid / default sentinel → undefined (implies default layer). */
export function sanitizeDiagramEntityLayerId(raw: string | undefined | null): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().slice(0, 96);
  if (t.length === 0 || t === DIAGRAM_LAYER_DEFAULT_ID) return undefined;
  if (!/^[\w-]+$/.test(t)) return undefined;
  return t;
}

export function effectiveDiagramLayerIdForEntity(layerId?: string | null): string {
  return sanitizeDiagramEntityLayerId(layerId ?? undefined) ?? DIAGRAM_LAYER_DEFAULT_ID;
}

function referencedCustomLayerIds(canvas: StageDesignCanvas): string[] {
  const found = new Set<string>();
  for (const p of canvas.placements) {
    const id = sanitizeDiagramEntityLayerId(p.layerId);
    if (id) found.add(id);
  }
  for (const s of canvas.shapes) {
    const id = sanitizeDiagramEntityLayerId(s.layerId);
    if (id) found.add(id);
  }
  for (const d of canvas.deckPolygons ?? []) {
    const id = sanitizeDiagramEntityLayerId(d.layerId);
    if (id) found.add(id);
  }
  return [...found].sort();
}

export function parseDiagramLayersField(raw: unknown): StageDiagramLayer[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: StageDiagramLayer[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (out.length >= MAX_DIAGRAM_LAYERS) break;
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    const idRaw = typeof rec.id === "string" ? rec.id.trim() : "";
    const id = sanitizeDiagramEntityLayerId(idRaw.length > 0 ? idRaw : null) ?? "";
    if (!id || id === DIAGRAM_LAYER_DEFAULT_ID) continue;
    const nameSrc = typeof rec.name === "string" ? rec.name.trim().slice(0, 96) : "";
    const name = nameSrc.length > 0 ? nameSrc.slice(0, 64) : "Layer";
    const visibleRaw = rec.visible;
    const visible =
      visibleRaw === false || visibleRaw === 0 ? false : visibleRaw === true || visibleRaw === 1 ? true : undefined;
    const groupSan = sanitizeDiagramLayerGroup(rec.group);
    const brRaw = rec.bracketReorderLocked;
    const bracketReorderLocked =
      brRaw === true || brRaw === 1 ? true : brRaw === false || brRaw === 0 ? false : undefined;
    if (seen.has(id)) continue;
    seen.add(id);
    const layerBase: StageDiagramLayer = visible === false ? { id, name, visible: false } : { id, name };
    if (groupSan) layerBase.group = groupSan;
    if (bracketReorderLocked === true) layerBase.bracketReorderLocked = true;
    out.push(layerBase);
  }
  return out.length > 0 ? out : undefined;
}

export function parseDiagramLayersJsonString(raw: string): StageDiagramLayer[] | undefined {
  const t = raw.trim().slice(0, MAX_DIAGRAM_LAYER_JSON_CHARS);
  if (t.length === 0 || t === "null") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(t) as unknown;
  } catch {
    return undefined;
  }
  return parseDiagramLayersField(parsed);
}

/**
 * Canonical ordered layer stack (bottom → top / front). Always includes {@link DIAGRAM_LAYER_DEFAULT_ID}
 * first, then authoring rows / auto-discovered ids.
 */
export function normalizeDiagramLayers(canvas: StageDesignCanvas): StageDiagramLayer[] {
  const parsed = canvas.diagramLayers ? parseDiagramLayersField(canvas.diagramLayers) ?? [] : [];
  const refs = referencedCustomLayerIds(canvas);
  const seen = new Set<string>();
  const rows: StageDiagramLayer[] = [
    {
      id: DIAGRAM_LAYER_DEFAULT_ID,
      name: "Main",
    },
  ];
  seen.add(DIAGRAM_LAYER_DEFAULT_ID);

  for (const row of parsed) {
    if (rows.length >= MAX_DIAGRAM_LAYERS) break;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const grp = sanitizeDiagramLayerGroup(row.group);
    const folded: StageDiagramLayer = {
      id: row.id,
      name: row.name.slice(0, 64),
    };
    if (row.visible === false) folded.visible = false;
    if (grp) folded.group = grp;
    if (row.bracketReorderLocked === true) folded.bracketReorderLocked = true;
    rows.push(folded);
  }
  for (const rid of refs) {
    if (rows.length >= MAX_DIAGRAM_LAYERS) break;
    if (seen.has(rid)) continue;
    seen.add(rid);
    rows.push({
      id: rid,
      name: `Layer ${rid.slice(0, 6)}`,
    });
  }

  return rows;
}

/** When **true**, bracket / Home–End primitives stay fixed within this authoring tier until unlocked. Main is never locked. */
export function diagramTierBracketReorderLocked(canvas: StageDesignCanvas, layerId: string): boolean {
  if (layerId === DIAGRAM_LAYER_DEFAULT_ID) return false;
  const row = normalizeDiagramLayers(canvas).find((l) => l.id === layerId);
  return row?.bracketReorderLocked === true;
}

/** True when authoring used anything beyond implicit single visible default stack. */
export function shouldPersistDiagramLayersField(canvas: StageDesignCanvas, normalized: StageDiagramLayer[]): boolean {
  if (normalized.length > 1) return true;
  if (referencedCustomLayerIds(canvas).length > 0) return true;
  const only = normalized[0];
  if (only?.visible === false) return true;
  return false;
}

export function reconcileDiagramLayersOnCanvas(canvas: StageDesignCanvas): StageDesignCanvas {
  const normalized = normalizeDiagramLayers(canvas);
  if (!shouldPersistDiagramLayersField(canvas, normalized)) return { ...canvas, diagramLayers: undefined };
  return { ...canvas, diagramLayers: normalized };
}

/** Paint order emitted to SVG: layer stack first, preserves {@link repairDiagramPaintOrder} order within buckets. */
export function diagramPaintRefsForPresentation(canvas: StageDesignCanvas): StageDiagramPaintRef[] {
  const base = repairDiagramPaintOrder(canvas);
  const definitions = normalizeDiagramLayers(canvas);
  const invisible = new Set(definitions.filter((d) => d.visible === false).map((d) => d.id));

  const buckets = new Map<string, StageDiagramPaintRef[]>();
  for (const ref of base) {
    const lid = effectiveDiagramLayerIdForPaintRef(canvas, ref);
    let arr = buckets.get(lid);
    if (!arr) {
      arr = [];
      buckets.set(lid, arr);
    }
    arr.push(ref);
  }

  const out: StageDiagramPaintRef[] = [];

  for (const layer of definitions) {
    const chunk = buckets.get(layer.id);
    if (chunk) buckets.delete(layer.id);
    if (invisible.has(layer.id)) continue;
    if (chunk?.length) out.push(...chunk);
  }

  const orphanBuckets = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [, chunk] of orphanBuckets) {
    if (chunk.length) out.push(...chunk);
  }

  return out;
}

/**
 * Resolved authoring-layer id for a diagram paint token ({@link StageDiagramPaintRef}).
 * The synthetic nominal-deck hull polygon is treated as Main.
 */
export function effectiveDiagramLayerIdForPaintRef(canvas: StageDesignCanvas, ref: StageDiagramPaintRef): string {
  if (ref.kind === "deck") {
    if (ref.id === SYNTHETIC_DECK_RECT_POLYGON_ID) return DIAGRAM_LAYER_DEFAULT_ID;
    const poly = lookupDeckIncludingSynthetic(canvas, ref.id);
    return effectiveDiagramLayerIdForEntity(poly?.layerId);
  }
  if (ref.kind === "shape") {
    const s = canvas.shapes.find((x) => x.id === ref.id);
    return effectiveDiagramLayerIdForEntity(s?.layerId);
  }
  const p = canvas.placements.find((x) => x.id === ref.id);
  return effectiveDiagramLayerIdForEntity(p?.layerId);
}

/**
 * Front-most (**presentation order**) selected primitive for bracket/HUD anchors when multi-select spans the unified stack.
 * Walks painting order tail→head and returns first match among deck (non-synthetic) · shape · placement id sets.
 */
export function diagramPaintLeadRefFromSelectionSets(
  canvas: StageDesignCanvas,
  sel: {
    deckIds: ReadonlySet<string>;
    shapeIds: ReadonlySet<string>;
    placementIds: ReadonlySet<string>;
  },
): StageDiagramPaintRef | null {
  const { deckIds, shapeIds, placementIds } = sel;
  const hasAnyDeck =
    [...deckIds].some((id) => id !== SYNTHETIC_DECK_RECT_POLYGON_ID);
  if (placementIds.size === 0 && shapeIds.size === 0 && !hasAnyDeck) return null;

  const order = diagramPaintRefsForPresentation(canvas);
  for (let i = order.length - 1; i >= 0; i--) {
    const r = order[i]!;
    if (r.kind === "deck") {
      if (r.id === SYNTHETIC_DECK_RECT_POLYGON_ID) continue;
      if (deckIds.has(r.id)) return r;
      continue;
    }
    if (r.kind === "shape" && shapeIds.has(r.id)) return r;
    if (r.kind === "placement" && placementIds.has(r.id)) return r;
  }
  return null;
}

/**
 * Adjacent swap along {@link diagramPaintRefsForPresentation} only among refs that share {@link effectiveDiagramLayerIdForPaintRef} with `sel`.
 * Returns a full presentation-shaped list suitable for persisting as `diagramPaintOrder`, or `null` if no swap applies.
 */
export function bumpDiagramPaintOrderWithinDiagramLayer(
  canvas: StageDesignCanvas,
  sel: StageDiagramPaintRef,
  dir: -1 | 1,
): StageDiagramPaintRef[] | null {
  const order = diagramPaintRefsForPresentation(canvas);
  const wantLayer = effectiveDiagramLayerIdForPaintRef(canvas, sel);
  if (diagramTierBracketReorderLocked(canvas, wantLayer)) return null;
  const idx = order.findIndex((r) => r.kind === sel.kind && r.id === sel.id);
  if (idx < 0) return null;

  const layerIndices: number[] = [];
  for (let i = 0; i < order.length; i++) {
    if (effectiveDiagramLayerIdForPaintRef(canvas, order[i]!) === wantLayer) layerIndices.push(i);
  }

  const pos = layerIndices.indexOf(idx);
  if (pos < 0) return null;
  const neighborRank = pos + dir;
  if (neighborRank < 0 || neighborRank >= layerIndices.length) return null;
  const j = layerIndices[neighborRank]!;

  const swapped = order.slice();
  const a = swapped[idx]!;
  swapped[idx] = swapped[j]!;
  swapped[j] = a;
  return swapped;
}

/**
 * Move `sel` to the back/front **within its layer bucket** only (same slice as brackets in {@link bumpDiagramPaintOrderWithinDiagramLayer}).
 */
export function moveDiagramPaintRefToDiagramLayerPaintExtreme(
  canvas: StageDesignCanvas,
  sel: StageDiagramPaintRef,
  extreme: "back" | "front",
): StageDiagramPaintRef[] | null {
  const order = diagramPaintRefsForPresentation(canvas);
  const wantLayer = effectiveDiagramLayerIdForPaintRef(canvas, sel);
  if (diagramTierBracketReorderLocked(canvas, wantLayer)) return null;

  const layerIndices: number[] = [];
  for (let i = 0; i < order.length; i++) {
    if (effectiveDiagramLayerIdForPaintRef(canvas, order[i]!) === wantLayer) layerIndices.push(i);
  }

  const idx = order.findIndex((r) => r.kind === sel.kind && r.id === sel.id);
  if (idx < 0) return null;
  const pos = layerIndices.indexOf(idx);
  if (pos < 0) return null;

  const targetRank = extreme === "back" ? 0 : layerIndices.length - 1;
  if (pos === targetRank) return null;

  const layerRefs = layerIndices.map((i) => order[i]!);
  const k = layerRefs.findIndex((r) => r.kind === sel.kind && r.id === sel.id);
  if (k < 0) return null;
  const picked = layerRefs.splice(k, 1)[0]!;
  if (extreme === "back") layerRefs.unshift(picked);
  else layerRefs.push(picked);

  const next = order.slice();
  for (let t = 0; t < layerIndices.length; t++) {
    next[layerIndices[t]!] = layerRefs[t]!;
  }
  return next;
}

function lookupDeckIncludingSynthetic(canvas: StageDesignCanvas, id: string): StageDeckPolygon | undefined {
  if (id === SYNTHETIC_DECK_RECT_POLYGON_ID) return undefined;
  return canvas.deckPolygons?.find((p) => p.id === id);
}

/** Single-tier row (producer layer list — Main or an ungrouped custom tier). */
export type DiagramLayerListPaneRow = { kind: "row"; index: number; layer: StageDiagramLayer };

/**
 * Nested folder node: either a leaf tier or a collapsible folder built from `/`-delimited {@link StageDiagramLayer.group} paths.
 */
export type DiagramLayerNestNode =
  | { kind: "tier"; index: number; layer: StageDiagramLayer }
  | { kind: "folder"; label: string; children: DiagramLayerNestNode[] };

/** Top-level list item: one row or a nested folder tree for a contiguous path-sharing block. */
export type DiagramLayerListPaneItem =
  | DiagramLayerListPaneRow
  | { kind: "nested"; roots: DiagramLayerNestNode[]; tierIndices: readonly number[] };

const MAX_DIAGRAM_LAYER_FOLDER_PATH_DEPTH = 8;

/** Split a sanitized folder field into path segments (`Rig / LX` → `["Rig","LX"]`). */
export function diagramLayerFolderPathSegments(groupField: unknown): string[] {
  const s = sanitizeDiagramLayerGroup(groupField);
  if (!s) return [];
  const parts = s
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.slice(0, MAX_DIAGRAM_LAYER_FOLDER_PATH_DEPTH);
}

/** Longest shared prefix among segment paths (may be empty). */
export function longestCommonDiagramFolderPathPrefix(paths: readonly (readonly string[])[]): string[] {
  if (paths.length === 0) return [];
  const first = paths[0]!;
  const out: string[] = [];
  for (let d = 0; d < first.length; d++) {
    const seg = first[d]!;
    if (!paths.every((p) => p[d] === seg)) break;
    out.push(seg);
  }
  return out;
}

type PathEntry = { index: number; layer: StageDiagramLayer; segments: string[] };

function nestNodesFromPathEntries(entries: readonly PathEntry[]): DiagramLayerNestNode[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.index - b.index);
  const buckets: Array<{ key: string | "__leaf__"; items: PathEntry[] }> = [];
  for (const e of sorted) {
    const key = e.segments.length === 0 ? "__leaf__" : e.segments[0]!;
    const last = buckets[buckets.length - 1];
    if (!last || last.key !== key) {
      buckets.push({ key, items: [e] });
    } else {
      last.items.push(e);
    }
  }

  const out: DiagramLayerNestNode[] = [];
  for (const b of buckets) {
    if (b.key === "__leaf__") {
      for (const e of b.items) {
        out.push({ kind: "tier", index: e.index, layer: e.layer });
      }
      continue;
    }
    const label = b.key;
    const peeled: PathEntry[] = b.items.map((e) => ({
      index: e.index,
      layer: e.layer,
      segments: e.segments.slice(1),
    }));
    if (peeled.every((p) => p.segments.length === 0)) {
      out.push({
        kind: "folder",
        label,
        children: peeled.map((e) => ({ kind: "tier", index: e.index, layer: e.layer })),
      });
      continue;
    }
    out.push({
      kind: "folder",
      label,
      children: nestNodesFromPathEntries(peeled),
    });
  }
  return out;
}

/** DFS — every tier index under this nested subtree. */
export function collectDiagramLayerNestTierIndices(nodes: readonly DiagramLayerNestNode[]): number[] {
  const ids: number[] = [];
  const walk = (arr: readonly DiagramLayerNestNode[]) => {
    for (const n of arr) {
      if (n.kind === "tier") ids.push(n.index);
      else walk(n.children);
    }
  };
  walk(nodes);
  return ids;
}

/**
 * Move one custom tier (`fromIndex`) to insert immediately before `toIndex` along the flat `diagramLayers` array.
 * Indices follow producer bottom→top list (**0 = Main**, immovable — both indices must be &gt; 0).
 */
export function reorderDiagramLayerStackRow(
  rows: readonly StageDiagramLayer[],
  fromIndex: number,
  toIndex: number,
): StageDiagramLayer[] | null {
  const n = rows.length;
  if (fromIndex === toIndex) return null;
  if (fromIndex <= 0 || toIndex <= 0 || fromIndex >= n || toIndex >= n) return null;
  const next = [...rows];
  const [picked] = next.splice(fromIndex, 1);
  if (!picked) return null;
  let insertAt = toIndex;
  if (fromIndex < toIndex) insertAt--;
  next.splice(insertAt, 0, picked);
  return next;
}

function maximalContiguousPathBlock(
  diagramLayers: readonly StageDiagramLayer[],
  startIdx: number,
): { endIdx: number; entries: PathEntry[] } {
  const entries: PathEntry[] = [];
  let j = startIdx;
  while (j < diagramLayers.length) {
    const layer = diagramLayers[j]!;
    if (layer.id === DIAGRAM_LAYER_DEFAULT_ID) break;
    const segments = diagramLayerFolderPathSegments(layer.group);
    if (segments.length === 0) break;
    const pathsSoFar = entries.map((e) => e.segments).concat([segments]);
    if (longestCommonDiagramFolderPathPrefix(pathsSoFar).length === 0) break;
    entries.push({ index: j, layer, segments });
    j++;
  }
  const endIdx = startIdx + entries.length - 1;
  return { endIdx, entries };
}

/**
 * Producer layer panel: Main row, then nested folder trees built from contiguous custom tiers sharing a nonempty `/`-aware path prefix,
 * with ungrouped custom tiers rendered as standalone rows — bottom→top order preserved.
 */
export function diagramLayersListPaneItems(diagramLayers: readonly StageDiagramLayer[]): DiagramLayerListPaneItem[] {
  const items: DiagramLayerListPaneItem[] = [];
  if (diagramLayers.length === 0) return items;

  items.push({ kind: "row", index: 0, layer: diagramLayers[0]! });

  let i = 1;
  while (i < diagramLayers.length) {
    const layer = diagramLayers[i]!;
    const segments =
      layer.id !== DIAGRAM_LAYER_DEFAULT_ID ? diagramLayerFolderPathSegments(layer.group) : [];

    if (segments.length === 0) {
      items.push({ kind: "row", index: i, layer });
      i++;
      continue;
    }

    const block = maximalContiguousPathBlock(diagramLayers, i);
    if (block.entries.length === 0) {
      items.push({ kind: "row", index: i, layer });
      i++;
      continue;
    }

    const roots = nestNodesFromPathEntries(block.entries);
    items.push({
      kind: "nested",
      roots,
      tierIndices: collectDiagramLayerNestTierIndices(roots),
    });
    i = block.endIdx + 1;
  }

  return items;
}

/** One path segment for nested folder fields (slashes collapsed; clipped before whole-string {@link sanitizeDiagramLayerGroup}). */
export function sanitizeDiagramLayerPathLeafSegment(raw: string): string | undefined {
  const t = raw
    .replace(/\/+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  if (t.length === 0) return undefined;
  if (/[\u0000-\u001f]/.test(t)) return undefined;
  return t;
}

/** Leaf segment appended after a dropped-on folder prefix: last `/` segment from `group`, else tier {@link StageDiagramLayer.name}. */
export function deriveDiagramFolderLeafSegment(layer: StageDiagramLayer): string {
  const segs = diagramLayerFolderPathSegments(layer.group);
  if (segs.length > 0) {
    const cand = sanitizeDiagramLayerPathLeafSegment(segs[segs.length - 1] ?? "");
    if (cand) return cand;
  }
  const fromName = sanitizeDiagramLayerPathLeafSegment(layer.name);
  return fromName ?? "Tier";
}

/** Join sanitized folder prefix segments + leaf; returns **`undefined`** if nothing persists. */
export function composeDiagramLayerFolderGroup(folderPrefixSegments: readonly string[], leafSegment: string): string | undefined {
  const parts: string[] = [];
  for (const p of folderPrefixSegments) {
    const s = sanitizeDiagramLayerPathLeafSegment(p);
    if (s) parts.push(s);
  }
  const leaf = sanitizeDiagramLayerPathLeafSegment(leafSegment);
  if (!leaf) return undefined;
  parts.push(leaf);
  const joined = parts.join(" / ");
  return sanitizeDiagramLayerGroup(joined);
}

/** Set `diagramLayers[fromIndex]` group under `folderPrefixSegments` (bottom→ancestors → dropped folder leaf). Leaves stack order untouched. */
export function assignDiagramTierUnderFolderPrefix(
  diagramLayers: readonly StageDiagramLayer[],
  tierFlatIndex: number,
  folderPrefixSegments: readonly string[],
): StageDiagramLayer[] | null {
  if (tierFlatIndex <= 0 || tierFlatIndex >= diagramLayers.length) return null;
  const tier = diagramLayers[tierFlatIndex]!;
  if (tier.id === DIAGRAM_LAYER_DEFAULT_ID) return null;
  const composed = composeDiagramLayerFolderGroup(folderPrefixSegments, deriveDiagramFolderLeafSegment(tier));
  if (!composed) return null;
  return diagramLayers.map((row, j) => (j === tierFlatIndex ? { ...row, group: composed } : row));
}

/** Populated primitives on one authoring tier (same **`layerId`** resolution as **`countPrimitivesOnDiagramLayer`**). */
export type DiagramLayerPrimitiveCounts = {
  placements: number;
  shapes: number;
  deckPolygons: number;
};

/** Break down placements vs shapes vs deck modules on **`layerId`** (includes **Main** sentinel). */
export function summarizePrimitivesOnDiagramLayer(
  canvas: StageDesignCanvas,
  layerId: string,
): DiagramLayerPrimitiveCounts {
  const resolvedCustom = sanitizeDiagramEntityLayerId(
    layerId === DIAGRAM_LAYER_DEFAULT_ID ? undefined : layerId,
  );
  const empty: DiagramLayerPrimitiveCounts = { placements: 0, shapes: 0, deckPolygons: 0 };
  if (layerId !== DIAGRAM_LAYER_DEFAULT_ID && resolvedCustom === undefined) return empty;

  const want = layerId === DIAGRAM_LAYER_DEFAULT_ID ? DIAGRAM_LAYER_DEFAULT_ID : resolvedCustom!;
  let placements = 0;
  let shapes = 0;
  let deckPolygons = 0;
  for (const p of canvas.placements) {
    if (effectiveDiagramLayerIdForEntity(p.layerId) === want) placements++;
  }
  for (const s of canvas.shapes) {
    if (effectiveDiagramLayerIdForEntity(s.layerId) === want) shapes++;
  }
  for (const poly of canvas.deckPolygons ?? []) {
    if (effectiveDiagramLayerIdForEntity(poly.layerId) === want) deckPolygons++;
  }
  return { placements, shapes, deckPolygons };
}

/** Count primitives whose effective layer equals `layerId` (must match a `{@link StageDiagramLayer}.id` including default). */
export function countPrimitivesOnDiagramLayer(canvas: StageDesignCanvas, layerId: string): number {
  const s = summarizePrimitivesOnDiagramLayer(canvas, layerId);
  return s.placements + s.shapes + s.deckPolygons;
}

/** Primitive **`id`** values on **`layerId`** (stable iteration: placements order, then shapes, then deck polygons). */
export function listPrimitiveIdsOnDiagramLayer(
  canvas: StageDesignCanvas,
  layerId: string,
): { placementIds: string[]; shapeIds: string[]; deckPolygonIds: string[] } {
  const resolvedCustom = sanitizeDiagramEntityLayerId(
    layerId === DIAGRAM_LAYER_DEFAULT_ID ? undefined : layerId,
  );
  const empty = { placementIds: [] as string[], shapeIds: [] as string[], deckPolygonIds: [] as string[] };
  if (layerId !== DIAGRAM_LAYER_DEFAULT_ID && resolvedCustom === undefined) return empty;

  const want = layerId === DIAGRAM_LAYER_DEFAULT_ID ? DIAGRAM_LAYER_DEFAULT_ID : resolvedCustom!;
  const placementIds: string[] = [];
  const shapeIds: string[] = [];
  const deckPolygonIds: string[] = [];
  for (const p of canvas.placements) {
    if (effectiveDiagramLayerIdForEntity(p.layerId) === want) placementIds.push(p.id);
  }
  for (const s of canvas.shapes) {
    if (effectiveDiagramLayerIdForEntity(s.layerId) === want) shapeIds.push(s.id);
  }
  for (const poly of canvas.deckPolygons ?? []) {
    if (effectiveDiagramLayerIdForEntity(poly.layerId) === want) deckPolygonIds.push(poly.id);
  }
  return { placementIds, shapeIds, deckPolygonIds };
}

/** One row per primitive for spreadsheets / scripts: **`placement|shape|deck`** then tab then **`id`**. */
export function diagramLayerPrimitiveIdsTsv(payload: {
  placementIds: readonly string[];
  shapeIds: readonly string[];
  deckPolygonIds: readonly string[];
}): string {
  const lines: string[] = [];
  for (const id of payload.placementIds) lines.push(`placement\t${id}`);
  for (const id of payload.shapeIds) lines.push(`shape\t${id}`);
  for (const id of payload.deckPolygonIds) lines.push(`deck\t${id}`);
  return lines.join("\n");
}

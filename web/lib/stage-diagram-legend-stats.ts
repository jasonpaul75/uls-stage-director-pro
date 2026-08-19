import type { StageDiagramCableRunKind } from "./stage-design-cable-run";
import { STAGE_DIAGRAM_CABLE_RUN_ORDER } from "./stage-design-cable-run";
import type {
  StageDesignCanvas,
  StageDesignPlacement,
  StageDesignPlacementKind,
  StageDesignShape,
  StageDesignShapeKind,
} from "./stage-design-canvas";
import {
  placementKindAllowsDmxEquipment,
  STAGE_DESIGN_FIXTURE_LIKE_KINDS,
  STAGE_DESIGN_PLACEMENT_KIND_ORDER,
  STAGE_DESIGN_SHAPE_KIND_ORDER,
} from "./stage-design-canvas";
import { normalizeDiagramLayers, DIAGRAM_LAYER_DEFAULT_ID, sanitizeDiagramLayerGroup } from "./stage-design-diagram-layers";
import {
  resolveFixtureCatalogJoin,
  type FixtureCatalogPresetRow,
} from "./stage-design-placements-csv";

/** Count placements per authored symbol kind (zero for kinds not present — map still has every canonical kind). */
export function histogramPlacementKinds(placements: readonly StageDesignPlacement[]): Map<StageDesignPlacementKind, number> {
  const m = new Map<StageDesignPlacementKind, number>();
  for (const k of STAGE_DESIGN_PLACEMENT_KIND_ORDER) m.set(k, 0);
  for (const p of placements) {
    m.set(p.kind, (m.get(p.kind) ?? 0) + 1);
  }
  return m;
}

/** Count shapes per shape kind — map includes each canonical shape kind. */
export function histogramShapeKinds(shapes: readonly StageDesignShape[]): Map<StageDesignShapeKind, number> {
  const m = new Map<StageDesignShapeKind, number>();
  for (const k of STAGE_DESIGN_SHAPE_KIND_ORDER) m.set(k, 0);
  for (const s of shapes) {
    m.set(s.kind, (m.get(s.kind) ?? 0) + 1);
  }
  return m;
}

/** Count LINE / POLYLINE shapes that carry a cable-run preset (custom stroke overrides still draw, but BOM lists the typed cable when set). */
export function histogramCableRunKinds(shapes: readonly StageDesignShape[]): Map<StageDiagramCableRunKind, number> {
  const m = new Map<StageDiagramCableRunKind, number>();
  for (const k of STAGE_DIAGRAM_CABLE_RUN_ORDER) m.set(k, 0);
  for (const s of shapes) {
    if (s.kind !== "LINE" && s.kind !== "POLYLINE") continue;
    const r = s.cableRun;
    if (!r) continue;
    m.set(r, (m.get(r) ?? 0) + 1);
  }
  return m;
}

export type LegendTierSummary = {
  /** Legend should show drafting-tier context (anything beyond implicit Main-only authoring). */
  show: boolean;
  /** Visible diagram tier display names stacked bottom→top (`normalizeDiagramLayers` order). */
  visibleLabelsBottomToTop: string[];
  /** Visible tiers with stable ids (legend ↔ inspector; Show reads folder + lock cues from producer). */
  visibleTierRowsBottomToTop: ReadonlyArray<{
    id: string;
    name: string;
    /** **`bracketReorderLocked`** tiers — intra-tier **`[` `]`** nudges disabled in producer. */
    drawOrderLocked?: boolean;
    /** Folder path (**`diagramLayers[].group`**) when set (≤32 chars in canvas). */
    folderPathHint?: string;
  }>;
  hiddenTierLabels: readonly string[];
};

/**
 * Readable tier strip for legends — mirrors producer **Diagram layers** stack; hidden tiers listed by label for clarity.
 */
export function summarizeDiagramTiersForLegend(canvas: StageDesignCanvas): LegendTierSummary {
  const normalized = normalizeDiagramLayers(canvas);
  const rows = normalized.map((l) => {
    const grp = sanitizeDiagramLayerGroup(l.group);
    const isMain = l.id === DIAGRAM_LAYER_DEFAULT_ID;
    return {
      visible: l.visible !== false,
      name: l.name.trim().length > 0 ? l.name : "Tier",
      id: l.id,
      drawOrderLocked: !isMain && l.bracketReorderLocked === true,
      folderPathHint: grp,
    };
  });
  const visibleRows = rows.filter((r) => r.visible);
  const visibleLabelsBottomToTop = visibleRows.map((r) => r.name);
  const visibleTierRowsBottomToTop = visibleRows.map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.drawOrderLocked ? { drawOrderLocked: true as const } : {}),
    ...(r.folderPathHint ? { folderPathHint: r.folderPathHint } : {}),
  }));
  const hiddenTierLabels = rows.filter((r) => !r.visible).map((r) => r.name);
  const show = rows.length > 1 || hiddenTierLabels.length > 0;
  return { show, visibleLabelsBottomToTop, visibleTierRowsBottomToTop, hiddenTierLabels };
}

export type LegendEquipmentMetaSummary = {
  /** Placements surfaced in legend (**cue**, **paired/partial DMX**, **patch**, **gel**, **fixture id/profile**). Empty `equipment` `{}` omitted. */
  annotatedCount: number;
  symbolsWithCueRole: number;
  symbolsWithPatchNote: number;
  symbolsWithGelNote: number;
  symbolsWithFixtureId: number;
  symbolsWithFixtureProfile: number;
  symbolsWithDmxPair: number;
  /** Universe or channel without its partner — still documented but titles skip U·ch until paired. */
  symbolsWithPartialDmx: number;
  /** Fixture / LED-wall rows where **Plot BOM** has `dmx_universe` but not `dmx_channel`. */
  symbolsWithDmxUniverseOnly: number;
  /** Fixture / LED-wall rows where **Plot BOM** has `dmx_channel` but not `dmx_universe`. */
  symbolsWithDmxChannelOnly: number;
  /** Distinct universes that appear on **paired** DMX addresses (fixture-capable symbols only). */
  pairedDmxDistinctUniverses: number;
  /** Sorted unique universe ints backing paired DMX (same scope as collisions). */
  pairedDmxUniversesSorted: readonly number[];
  /** Paired (`U`,`ch`) slots referenced by more than one fixture-capable symbol. */
  pairedDmxCollidingSlots: number;
  /** Fixtures beyond the first at each colliding paired slot (`sum(count - 1)` per duplicate slot). */
  pairedDmxDuplicateFixtureExtras: number;
};

function finiteEquipmentInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Compact ascending integers as `1, 3–5, 9` for legend footers (expects deduped sorted input). */
export function formatSortedIntRanges(sortedUnique: readonly number[]): string {
  if (sortedUnique.length === 0) return "";
  const parts: string[] = [];
  let s = sortedUnique[0]!;
  let p = s;
  for (let i = 1; i < sortedUnique.length; i++) {
    const n = sortedUnique[i]!;
    if (n === p + 1) {
      p = n;
      continue;
    }
    parts.push(s === p ? `${s}` : `${s}–${p}`);
    s = p = n;
  }
  parts.push(s === p ? `${s}` : `${s}–${p}`);
  return parts.join(", ");
}

/**
 * Lightweight readout matching MVP **`equipment`** semantics (producer / BOM / SVG titles).
 */
export function summarizeEquipmentMetadataForLegend(
  placements: readonly StageDesignPlacement[],
): LegendEquipmentMetaSummary {
  let annotatedCount = 0;
  let symbolsWithCueRole = 0;
  let symbolsWithPatchNote = 0;
  let symbolsWithGelNote = 0;
  let symbolsWithFixtureId = 0;
  let symbolsWithFixtureProfile = 0;
  let symbolsWithDmxPair = 0;
  let symbolsWithPartialDmx = 0;
  let symbolsWithDmxUniverseOnly = 0;
  let symbolsWithDmxChannelOnly = 0;

  const pairedAddrCounts = new Map<string, number>();

  for (const p of placements) {
    const e = p.equipment;
    if (!e) continue;

    const allowDmx = placementKindAllowsDmxEquipment(p.kind);
    const roleOk = typeof e.role === "string" && e.role.trim().length > 0;
    const patchOk = typeof e.patch === "string" && e.patch.trim().length > 0;
    const gelOk = typeof e.gel === "string" && e.gel.trim().length > 0;
    const fixtureIdOk = typeof e.fixtureId === "string" && e.fixtureId.trim().length > 0;
    const fixtureProfileOk = typeof e.fixtureProfile === "string" && e.fixtureProfile.trim().length > 0;
    const uPresent = finiteEquipmentInt(e.dmxUniverse);
    const chPresent = finiteEquipmentInt(e.dmxChannel);
    const uOk = allowDmx && uPresent;
    const chOk = allowDmx && chPresent;
    const dmxPair = uOk && chOk;
    const partialDmx = allowDmx && !dmxPair && (uPresent || chPresent);

    if (!roleOk && !dmxPair && !partialDmx && !patchOk && !gelOk && !fixtureIdOk && !fixtureProfileOk) continue;

    annotatedCount++;
    if (roleOk) symbolsWithCueRole++;
    if (patchOk) symbolsWithPatchNote++;
    if (gelOk) symbolsWithGelNote++;
    if (fixtureIdOk) symbolsWithFixtureId++;
    if (fixtureProfileOk) symbolsWithFixtureProfile++;
    if (dmxPair) symbolsWithDmxPair++;
    if (partialDmx) {
      symbolsWithPartialDmx++;
      if (uOk && !chOk) symbolsWithDmxUniverseOnly++;
      if (chOk && !uOk) symbolsWithDmxChannelOnly++;
    }

    if (
      placementKindAllowsDmxEquipment(p.kind) &&
      dmxPair &&
      e.dmxUniverse !== undefined &&
      e.dmxChannel !== undefined &&
      e.dmxUniverse >= 1 &&
      e.dmxUniverse <= 256 &&
      e.dmxChannel >= 1 &&
      e.dmxChannel <= 512
    ) {
      const key = `${e.dmxUniverse}:${e.dmxChannel}`;
      pairedAddrCounts.set(key, (pairedAddrCounts.get(key) ?? 0) + 1);
    }
  }

  let pairedDmxCollidingSlots = 0;
  let pairedDmxDuplicateFixtureExtras = 0;
  for (const c of pairedAddrCounts.values()) {
    if (c > 1) {
      pairedDmxCollidingSlots++;
      pairedDmxDuplicateFixtureExtras += c - 1;
    }
  }

  const universeSet = new Set<number>();
  for (const k of pairedAddrCounts.keys()) {
    const u = Number.parseInt(k.split(":")[0]!, 10);
    if (Number.isFinite(u)) universeSet.add(u);
  }
  const pairedDmxUniversesSorted = [...universeSet].sort((a, b) => a - b);

  return {
    annotatedCount,
    symbolsWithCueRole,
    symbolsWithPatchNote,
    symbolsWithGelNote,
    symbolsWithFixtureId,
    symbolsWithFixtureProfile,
    symbolsWithDmxPair,
    symbolsWithPartialDmx,
    symbolsWithDmxUniverseOnly,
    symbolsWithDmxChannelOnly,
    pairedDmxDistinctUniverses: pairedDmxUniversesSorted.length,
    pairedDmxUniversesSorted,
    pairedDmxCollidingSlots,
    pairedDmxDuplicateFixtureExtras,
  };
}

export type LegendFixtureCatalogJoinSummary = {
  show: boolean;
  fixtureSymbolCount: number;
  catalogRowCount: number;
  joinedCount: number;
  joinedByPresetLabel: number;
  joinedByFixtureId: number;
  unmatchedCount: number;
  symbolsWithPresetLabelStamp: number;
  /** Distinct `fixture_preset_label` values on symbols that did not resolve to a catalog row. */
  unmatchedPresetLabels: readonly string[];
};

/**
 * Producer legend QA for **Fixtures CSV + join** — tallies catalog matches vs unmatched preset stamps.
 * Pass `catalog` from browser fixture library merged with hosted shared presets.
 */
export function summarizeFixtureCatalogJoinForLegend(
  placements: readonly StageDesignPlacement[],
  catalog: readonly FixtureCatalogPresetRow[],
): LegendFixtureCatalogJoinSummary {
  const fixtures = placements.filter((p) => STAGE_DESIGN_FIXTURE_LIKE_KINDS.has(p.kind));
  const fixtureSymbolCount = fixtures.length;
  const catalogRowCount = catalog.length;

  let joinedByPresetLabel = 0;
  let joinedByFixtureId = 0;
  let unmatchedCount = 0;
  let symbolsWithPresetLabelStamp = 0;
  const unmatchedPresetLabelSet = new Set<string>();

  for (const p of fixtures) {
    const preset = p.equipment?.fixturePresetLabel?.trim();
    if (preset) symbolsWithPresetLabelStamp++;

    const j = resolveFixtureCatalogJoin(p.equipment, catalog);
    if (j.match === "fixture_preset_label") joinedByPresetLabel++;
    else if (j.match === "fixture_id") joinedByFixtureId++;
    else {
      unmatchedCount++;
      if (preset) unmatchedPresetLabelSet.add(preset);
    }
  }

  const joinedCount = joinedByPresetLabel + joinedByFixtureId;
  const unmatchedPresetLabels = [...unmatchedPresetLabelSet].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  const show =
    fixtureSymbolCount > 0 &&
    (catalogRowCount > 0 || symbolsWithPresetLabelStamp > 0 || joinedCount > 0);

  return {
    show,
    fixtureSymbolCount,
    catalogRowCount,
    joinedCount,
    joinedByPresetLabel,
    joinedByFixtureId,
    unmatchedCount,
    symbolsWithPresetLabelStamp,
    unmatchedPresetLabels,
  };
}

export type PairedDmxCollisionRow = {
  dmxUniverse: number;
  dmxChannel: number;
  assignmentCount: number;
};

/** Every paired DMX slot referenced by more than one fixture-capable symbol. */
export function listPairedDmxAddressCollisions(
  placements: readonly StageDesignPlacement[],
): PairedDmxCollisionRow[] {
  const pairedAddrCounts = new Map<string, { u: number; ch: number; count: number }>();
  for (const p of placements) {
    if (!placementKindAllowsDmxEquipment(p.kind)) continue;
    const e = p.equipment;
    if (!e || !finiteEquipmentInt(e.dmxUniverse) || !finiteEquipmentInt(e.dmxChannel)) continue;
    if (e.dmxUniverse < 1 || e.dmxUniverse > 256 || e.dmxChannel < 1 || e.dmxChannel > 512) continue;
    const key = `${e.dmxUniverse}:${e.dmxChannel}`;
    const prev = pairedAddrCounts.get(key);
    if (prev) prev.count++;
    else pairedAddrCounts.set(key, { u: e.dmxUniverse, ch: e.dmxChannel, count: 1 });
  }
  const out: PairedDmxCollisionRow[] = [];
  for (const row of pairedAddrCounts.values()) {
    if (row.count <= 1) continue;
    out.push({ dmxUniverse: row.u, dmxChannel: row.ch, assignmentCount: row.count });
  }
  out.sort((a, b) => a.dmxUniverse - b.dmxUniverse || a.dmxChannel - b.dmxChannel);
  return out;
}

export const STAGE_DESIGN_EQUIPMENT_QA_SCHEMA_VERSION = 1 as const;

export type StageDesignEquipmentOpsSummaryV1 = {
  schemaVersion: typeof STAGE_DESIGN_EQUIPMENT_QA_SCHEMA_VERSION;
  generatedAt: string;
  equipment: LegendEquipmentMetaSummary;
  catalogJoin: LegendFixtureCatalogJoinSummary | null;
  dmxCollisions: readonly PairedDmxCollisionRow[];
};

/**
 * Structured equipment QA for downstream ops (producer pack **`{slug}-equipment-qa.json`**, integrations).
 * Pass **`catalog`** when browser + hosted fixture presets are available (producer); omit on Show-only snapshots.
 */
export function buildStageDesignEquipmentOpsSummary(
  canvas: Pick<StageDesignCanvas, "placements">,
  catalog?: readonly FixtureCatalogPresetRow[],
): StageDesignEquipmentOpsSummaryV1 {
  const equipment = summarizeEquipmentMetadataForLegend(canvas.placements);
  const catalogJoin =
    catalog !== undefined ? summarizeFixtureCatalogJoinForLegend(canvas.placements, catalog) : null;
  return {
    schemaVersion: STAGE_DESIGN_EQUIPMENT_QA_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    equipment,
    catalogJoin: catalogJoin?.show ? catalogJoin : catalogJoin && catalogJoin.catalogRowCount > 0 ? catalogJoin : null,
    dmxCollisions: listPairedDmxAddressCollisions(canvas.placements),
  };
}

export function stageDesignEquipmentOpsSummaryToJson(
  summary: StageDesignEquipmentOpsSummaryV1,
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}

import { Fragment } from "react";
import {
  STAGE_DESIGN_FIXTURE_LIKE_KINDS,
  STAGE_DESIGN_KIND_LABELS,
  STAGE_DESIGN_PLACEMENT_KIND_ORDER,
  STAGE_DESIGN_SHAPE_KIND_ORDER,
  STAGE_SHAPE_KIND_LABELS,
  SYNTHETIC_DECK_RECT_POLYGON_ID,
  type StageDesignCanvas,
  type StageDesignPlacementKind,
} from "@/lib/stage-design-canvas";
import { STAGE_PLACEMENT_GLYPH_STYLE } from "@/lib/stage-design-placement-glyph-style";
import {
  STAGE_DIAGRAM_CABLE_RUN_LABELS,
  STAGE_DIAGRAM_CABLE_RUN_ORDER,
  cableRunPresentationStroke,
  type StageDiagramCableRunKind,
} from "@/lib/stage-design-cable-run";
import {
  histogramCableRunKinds,
  histogramPlacementKinds,
  histogramShapeKinds,
  summarizeDiagramTiersForLegend,
  summarizeEquipmentMetadataForLegend,
  summarizeFixtureCatalogJoinForLegend,
  formatSortedIntRanges,
} from "@/lib/stage-diagram-legend-stats";
import type { FixtureCatalogPresetRow } from "@/lib/stage-design-placements-csv";

type Props = {
  canvas: StageDesignCanvas;
  /** When set (e.g. producer sticky-tier id), emphasizes that tier in the diagram-tiers legend strip. */
  tierHighlightLayerId?: string;
  /** Browser + hosted fixture presets for producer catalog-join QA (omit on Show / portal). */
  fixtureCatalog?: readonly FixtureCatalogPresetRow[];
};

function PlacementSwatch({ kind }: { kind: StageDesignPlacementKind }) {
  const st = STAGE_PLACEMENT_GLYPH_STYLE[kind];
  const box =
    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-white/[0.12] bg-black/40";

  switch (kind) {
    case "FIXTURE":
    case "WASH_MOVING":
    case "PAR_STATIC":
    case "UPLIGHT":
      return (
        <span className={box} aria-hidden>
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: st.fill,
              boxShadow: `0 0 0 1px ${st.stroke}`,
            }}
          />
        </span>
      );
    case "BEAM_MOVING":
      return (
        <span className={box} aria-hidden>
          <svg width="16" height="12" viewBox="-8 -6 16 12" className="overflow-visible">
            <ellipse
              cx="0"
              cy="0"
              rx="5.5"
              ry="3.25"
              fill={st.fill}
              stroke={st.stroke}
              strokeWidth={1.35}
            />
            <line x1="0" y1="-2" x2="0" y2="4" stroke={st.stroke} strokeWidth={1} strokeLinecap="round" />
          </svg>
        </span>
      );
    case "POWER":
    case "POWER_DROP":
      return (
        <span className={box} aria-hidden>
          <svg width="14" height="14" viewBox="-7 -8 14 14" className="overflow-visible">
            <polygon points="0,-5 6,5 -6,5" fill={st.fill} stroke={st.stroke} strokeWidth="1" />
          </svg>
        </span>
      );
    case "DECOR":
      return (
        <span className={box} aria-hidden>
          <span
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{
              backgroundColor: st.fill,
              boxShadow: `inset 0 0 0 1px ${st.stroke}`,
            }}
          />
        </span>
      );
    case "TRUSS":
      return (
        <span className={box} aria-hidden>
          <svg width="16" height="10" viewBox="-8 -3 16 10" className="overflow-visible">
            <line
              x1="-6"
              y1="2"
              x2="6"
              y2="2"
              stroke={st.stroke}
              strokeWidth="2.5"
              strokeLinecap="square"
            />
          </svg>
        </span>
      );
    case "STRIP_FIXED":
      return (
        <span className={box} aria-hidden>
          <span
            className="h-1 w-5 rounded-[1px]"
            style={{
              backgroundColor: st.fill,
              boxShadow: `0 0 0 1px ${st.stroke}`,
            }}
          />
        </span>
      );
    case "LED_WALL":
      return (
        <span className={box} aria-hidden>
          <span
            className="h-2 w-5 rounded-[1px]"
            style={{
              backgroundColor: st.fill,
              boxShadow: `0 0 0 1px ${st.stroke}`,
            }}
          />
        </span>
      );
    case "PROJECTOR_SYM":
      return (
        <span className={box} aria-hidden>
          <svg width="18" height="12" viewBox="-9 -6 18 12" className="overflow-visible">
            <rect
              x="-6.5"
              y="-4.5"
              width="13"
              height="9"
              rx={1.25}
              fill={st.fill}
              stroke={st.stroke}
              strokeWidth={1.35}
            />
            <circle cx="0" cy={1} r={2} fill="rgba(8,14,22,0.55)" stroke={st.stroke} strokeWidth={1} />
          </svg>
        </span>
      );
    default:
      return null;
  }
}

function CableRunSwatch({ kind }: { kind: StageDiagramCableRunKind }) {
  const p = cableRunPresentationStroke(kind);
  const box =
    "flex h-[18px] w-[22px] shrink-0 items-center justify-center rounded border border-white/[0.12] bg-black/40";
  return (
    <span className={box} aria-hidden>
      <svg width="20" height="8" viewBox="0 0 20 8" className="overflow-visible">
        <line
          x1={1}
          y1={4}
          x2={19}
          y2={4}
          stroke={p.stroke}
          strokeWidth={2.75}
          strokeLinecap="round"
          {...(p.strokeDasharray ? { strokeDasharray: p.strokeDasharray } : {})}
        />
      </svg>
    </span>
  );
}

export function StageDiagramLegend(props: Props) {
  const { canvas, tierHighlightLayerId, fixtureCatalog } = props;
  const userDeckPolygonCount =
    canvas.deckPolygons?.filter((p) => p.id !== SYNTHETIC_DECK_RECT_POLYGON_ID).length ?? 0;
  const placementHistogram = histogramPlacementKinds(canvas.placements);
  const trussSymbolCount = placementHistogram.get("TRUSS") ?? 0;
  const fixtureSymbolCount = canvas.placements.reduce(
    (acc, p) => acc + (STAGE_DESIGN_FIXTURE_LIKE_KINDS.has(p.kind) ? 1 : 0),
    0,
  );

  const usedKinds = new Set(canvas.placements.map((p) => p.kind));
  const placementKindsOrdered = STAGE_DESIGN_PLACEMENT_KIND_ORDER.filter((k) => usedKinds.has(k));

  const shapeHistogram = histogramShapeKinds(canvas.shapes);
  const cableRunHistogram = histogramCableRunKinds(canvas.shapes);
  const usedShapeKinds = new Set(canvas.shapes.map((s) => s.kind));
  const shapeKindsOrdered = STAGE_DESIGN_SHAPE_KIND_ORDER.filter((k) => usedShapeKinds.has(k));

  const cableKindsOrdered = STAGE_DIAGRAM_CABLE_RUN_ORDER.filter((k) => (cableRunHistogram.get(k) ?? 0) > 0);

  const equipmentLegend = summarizeEquipmentMetadataForLegend(canvas.placements);
  const catalogJoinLegend =
    fixtureCatalog !== undefined
      ? summarizeFixtureCatalogJoinForLegend(canvas.placements, fixtureCatalog)
      : null;

  const equipmentSubtitleFragments = (() => {
    if (equipmentLegend.annotatedCount === 0) return [] as string[];
    const frag: string[] = [];
    if (equipmentLegend.symbolsWithCueRole > 0) {
      frag.push(
        `${equipmentLegend.symbolsWithCueRole} cue label${equipmentLegend.symbolsWithCueRole === 1 ? "" : "s"}`,
      );
    }
    if (equipmentLegend.symbolsWithPatchNote > 0) {
      frag.push(
        `${equipmentLegend.symbolsWithPatchNote} patch note${equipmentLegend.symbolsWithPatchNote === 1 ? "" : "s"}`,
      );
    }
    if (equipmentLegend.symbolsWithGelNote > 0) {
      frag.push(`${equipmentLegend.symbolsWithGelNote} gel/color note${equipmentLegend.symbolsWithGelNote === 1 ? "" : "s"}`);
    }
    if (equipmentLegend.symbolsWithFixtureId > 0) {
      frag.push(
        `${equipmentLegend.symbolsWithFixtureId} fixture id${equipmentLegend.symbolsWithFixtureId === 1 ? "" : "s"}`,
      );
    }
    if (equipmentLegend.symbolsWithFixtureProfile > 0) {
      frag.push(
        `${equipmentLegend.symbolsWithFixtureProfile} beam/profile note${equipmentLegend.symbolsWithFixtureProfile === 1 ? "" : "s"}`,
      );
    }
    if (equipmentLegend.symbolsWithDmxPair > 0) {
      frag.push(
        `${equipmentLegend.symbolsWithDmxPair} paired DMX on fixtures & LED surfaces (U·ch in SVG titles)`,
      );
    }
    if (equipmentLegend.pairedDmxDistinctUniverses > 0) {
      frag.push(
        `paired DMX spans universe${equipmentLegend.pairedDmxDistinctUniverses === 1 ? "" : "s"} ${formatSortedIntRanges(equipmentLegend.pairedDmxUniversesSorted)}`,
      );
    }
    if (equipmentLegend.pairedDmxCollidingSlots > 0) {
      frag.push(
        `${equipmentLegend.pairedDmxDuplicateFixtureExtras} duplicate paired-address assignment${equipmentLegend.pairedDmxDuplicateFixtureExtras === 1 ? "" : "s"} (${equipmentLegend.pairedDmxCollidingSlots} DMX slot${equipmentLegend.pairedDmxCollidingSlots === 1 ? "" : "s"} with collisions)`,
      );
    }
    if (equipmentLegend.symbolsWithPartialDmx > 0) {
      const u = equipmentLegend.symbolsWithDmxUniverseOnly;
      const ch = equipmentLegend.symbolsWithDmxChannelOnly;
      const breakdown =
        u > 0 && ch > 0
          ? `${u} universe-only · ${ch} channel-only`
          : u > 0
            ? `${u} universe-only`
            : `${ch} channel-only`;
      frag.push(
        `${equipmentLegend.symbolsWithPartialDmx} partial DMX on fixtures & LED surfaces (Plot BOM: ${breakdown}; U·ch in SVG titles when both halves are present)`,
      );
    }
    return frag;
  })();

  const tierLegend = summarizeDiagramTiersForLegend(canvas);

  if (placementKindsOrdered.length === 0 && shapeKindsOrdered.length === 0 && cableKindsOrdered.length === 0) return null;

  const equipmentSymbolPlural = equipmentLegend.annotatedCount === 1 ? "" : "s";
  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-uls-subtle">Legend</p>
      {tierLegend.show ? (
        <p className="mt-2 border-b border-white/[0.06] pb-2 text-[11px] leading-snug text-uls-muted">
          <span className="font-medium text-uls-text">Diagram tiers</span>
          <span className="text-uls-subtle">{" — bottom→top: "}</span>
          <span className="text-uls-muted">
            {tierLegend.visibleTierRowsBottomToTop.map((t, ti) => {
              const hintBits: string[] = [];
              if (t.folderPathHint) hintBits.push(`Folder: ${t.folderPathHint}`);
              if (t.drawOrderLocked)
                hintBits.push("Producer: draw-order nudges ([ ], Home/End) locked inside this tier");
              const tierTitle = hintBits.length > 0 ? hintBits.join(" · ") : undefined;
              return (
                <Fragment key={t.id}>
                  {ti > 0 ? " · " : null}
                  <span
                    className={`inline-flex items-baseline gap-0.5 ${
                      t.id === tierHighlightLayerId ? "font-semibold text-uls-accent" : ""
                    }`}
                    title={tierTitle}
                  >
                    <span>{t.name}</span>
                    {t.drawOrderLocked ? (
                      <span
                        className="rounded border border-white/[0.12] px-0.5 text-[9px] font-normal uppercase tracking-tight text-uls-subtle"
                        aria-hidden
                      >
                        lock
                      </span>
                    ) : null}
                  </span>
                </Fragment>
              );
            })}
          </span>
          {tierLegend.hiddenTierLabels.length > 0 ? (
            <span className="text-uls-subtle">{` · hidden (${tierLegend.hiddenTierLabels.join(", ")})`}</span>
          ) : null}
        </p>
      ) : null}
      <div className="mt-2 flex items-start gap-2 border-b border-white/[0.06] pb-2 text-[11px] leading-snug text-uls-muted">
        <span
          className="flex h-[18px] w-[28px] shrink-0 items-center justify-center rounded border border-white/[0.12] bg-black/40"
          aria-hidden
        >
          <svg width="22" height="12" viewBox="0 0 22 12" className="overflow-visible">
            <polygon
              points="1,10 21,10 18,2 4,2"
              fill="rgba(251,191,36,0.12)"
              stroke="rgba(251,191,36,0.45)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="min-w-0">
          <span className="font-medium text-uls-text">Deck</span>
          <span className="text-uls-subtle">
            {" "}
            — amber polygons outline performance platforms (nominal footprint or several modular rectangles).
          </span>
        </p>
      </div>
      {placementKindsOrdered.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {placementKindsOrdered.map((kind) => (
            <li key={kind} className="flex items-center gap-2 text-[11px] text-uls-muted">
              <PlacementSwatch kind={kind} />
              <span className="text-uls-text">{STAGE_DESIGN_KIND_LABELS[kind]}</span>
              <span className="tabular-nums text-uls-subtle">×{placementHistogram.get(kind) ?? 0}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {shapeKindsOrdered.length > 0 ? (
        <ul
          className={`${
            placementKindsOrdered.length > 0 ? "mt-2 border-t border-white/[0.06] pt-2" : "mt-2"
          } flex flex-wrap gap-x-4 gap-y-1.5`}
        >
          {shapeKindsOrdered.map((kind) => (
            <li key={kind} className="text-[11px] text-uls-muted">
              <span className="font-medium text-uls-text">{STAGE_SHAPE_KIND_LABELS[kind]}</span>
              <span className="tabular-nums text-uls-subtle"> ×{shapeHistogram.get(kind) ?? 0}</span>
              <span className="text-uls-subtle"> — drawn on plot.</span>
              {kind === "LINE" || kind === "POLYLINE" ? (
                cableKindsOrdered.length > 0 ? (
                  <span className="text-uls-subtle">
                    {" "}
                    Optional <span className="font-medium text-uls-muted">cable type</span> presets (when no custom outline color)
                    match the strokes in the cable list below; <span className="font-medium text-uls-muted">Plot BOM CSV</span>{" "}
                    includes a <span className="font-mono text-[10px] text-uls-text/90">cable_run</span> token on line/polyline
                    rows.
                  </span>
                ) : (
                  <span className="text-uls-subtle">
                    {" "}
                    Producer can classify runs with <span className="font-medium text-uls-muted">cable type</span> presets (see BOM{" "}
                    <span className="font-mono text-[10px] text-uls-text/90">cable_run</span> column).
                  </span>
                )
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {cableKindsOrdered.length > 0 ? (
        <ul
          className={`${
            placementKindsOrdered.length > 0 || shapeKindsOrdered.length > 0
              ? "mt-2 border-t border-white/[0.06] pt-2"
              : "mt-2"
          } flex flex-wrap gap-x-4 gap-y-2`}
        >
          {cableKindsOrdered.map((ck) => (
            <li key={ck} className="flex items-center gap-2 text-[11px] text-uls-muted">
              <CableRunSwatch kind={ck} />
              <span className="text-uls-text">{STAGE_DIAGRAM_CABLE_RUN_LABELS[ck]}</span>
              <span className="tabular-nums text-uls-subtle">×{cableRunHistogram.get(ck) ?? 0}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {equipmentLegend.annotatedCount > 0 ? (
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] leading-snug text-uls-muted">
          <span className="font-medium text-uls-subtle">Equipment captions</span> —{" "}
          <span className="tabular-nums text-uls-text/90">{equipmentLegend.annotatedCount}</span> symbol{equipmentSymbolPlural}{" "}
          annotate optional <span className="font-medium text-uls-subtle">equipment</span>
          {equipmentSubtitleFragments.length > 0
            ? ` (${equipmentSubtitleFragments.join(" · ")})`
            : ""}
          . Producer <span className="font-medium text-uls-subtle">Plot BOM CSV</span> carries cue / fixture id / profile /
          DMX columns on symbols plus shape anchors (see export row).
          {trussSymbolCount > 0 ? (
            <>
              {" "}
              Producer <span className="font-medium text-uls-subtle">Truss CSV</span>
              {' '}
              ({trussSymbolCount} truss segment{trussSymbolCount === 1 ? "" : "s"}) lists truss symbols only — no shapes or
              deck tables.
            </>
          ) : null}
          {fixtureSymbolCount > 0 ? (
            <>
              {" "}
              Producer <span className="font-medium text-uls-subtle">Fixtures CSV</span>
              {' '}
              ({fixtureSymbolCount} lighting / video surface / strip symbol{fixtureSymbolCount === 1 ? "" : "s"}) lists that slice
              only — no truss, power, décor, or shapes.
            </>
          ) : null}
        </p>
      ) : null}
      {equipmentLegend.annotatedCount === 0 && (trussSymbolCount > 0 || fixtureSymbolCount > 0) ? (
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] leading-snug text-uls-muted">
          {trussSymbolCount > 0 ? (
            <>
              Producer <span className="font-medium text-uls-subtle">Truss CSV</span> —{" "}
              <span className="font-medium text-uls-subtle">{trussSymbolCount}</span> truss segment
              {trussSymbolCount === 1 ? "" : "s"} on plot (symbols only; no shapes or deck tables).
            </>
          ) : null}
          {trussSymbolCount > 0 && fixtureSymbolCount > 0 ? <> {" "} </> : null}
          {fixtureSymbolCount > 0 ? (
            <>
              Producer <span className="font-medium text-uls-subtle">Fixtures CSV</span> —{" "}
              <span className="font-medium text-uls-subtle">{fixtureSymbolCount}</span> lighting / LED / strip / projector
              symbol
              {fixtureSymbolCount === 1 ? "" : "s"} on plot (fixtures slice only — no truss, power, or shapes).
            </>
          ) : null}
        </p>
      ) : null}
      {userDeckPolygonCount > 0 ? (
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] leading-snug text-uls-muted">
          <span className="font-medium text-uls-subtle">Deck modules</span> —{" "}
          <span className="font-medium text-uls-subtle">Plot BOM CSV</span> adds a deck table (vertex ring preview, axis-aligned
          bounds, diagram tier) after symbols and shapes when modular platforms are authored.
        </p>
      ) : null}
      {catalogJoinLegend?.show ? (
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] leading-snug text-uls-muted">
          <span className="font-medium text-uls-subtle">Fixture catalog joins</span> —{" "}
          <span className="tabular-nums text-uls-text/90">{catalogJoinLegend.joinedCount}</span> of{" "}
          <span className="tabular-nums text-uls-text/90">{catalogJoinLegend.fixtureSymbolCount}</span> fixture symbol
          {catalogJoinLegend.fixtureSymbolCount === 1 ? "" : "s"} match the merged browser + hosted catalog (
          <span className="tabular-nums text-uls-text/90">{catalogJoinLegend.catalogRowCount}</span> preset row
          {catalogJoinLegend.catalogRowCount === 1 ? "" : "s"}
          {catalogJoinLegend.joinedByPresetLabel > 0 || catalogJoinLegend.joinedByFixtureId > 0
            ? ` — ${catalogJoinLegend.joinedByPresetLabel} by preset label · ${catalogJoinLegend.joinedByFixtureId} by unique fixture id`
            : ""}
          ).
          {catalogJoinLegend.symbolsWithPresetLabelStamp > 0 ? (
            <>
              {" "}
              <span className="tabular-nums text-uls-text/90">{catalogJoinLegend.symbolsWithPresetLabelStamp}</span> symbol
              {catalogJoinLegend.symbolsWithPresetLabelStamp === 1 ? "" : "s"} stamp{" "}
              <span className="font-mono text-[10px] text-uls-text/90">fixture_preset_label</span>.
            </>
          ) : null}
          {catalogJoinLegend.unmatchedCount > 0 ? (
            <>
              {" "}
              <span className="font-medium text-amber-200/90">
                {catalogJoinLegend.unmatchedCount} unmatched
              </span>
              {catalogJoinLegend.unmatchedPresetLabels.length > 0
                ? ` (preset labels: ${catalogJoinLegend.unmatchedPresetLabels.join(", ")})`
                : " (no catalog row for preset label or fixture id)"}
              .
            </>
          ) : null}{" "}
          Producer <span className="font-medium text-uls-subtle">Fixtures CSV + join</span> and{" "}
          <span className="font-medium text-uls-subtle">Producer pack</span> use the same catalog snapshot.
        </p>
      ) : null}
    </div>
  );
}

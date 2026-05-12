import { Fragment } from "react";
import {
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
  histogramPlacementKinds,
  histogramShapeKinds,
  summarizeDiagramTiersForLegend,
  summarizeEquipmentMetadataForLegend,
} from "@/lib/stage-diagram-legend-stats";

type Props = {
  canvas: StageDesignCanvas;
  /** When set (e.g. producer sticky-tier id), emphasizes that tier in the diagram-tiers legend strip. */
  tierHighlightLayerId?: string;
};

function PlacementSwatch({ kind }: { kind: StageDesignPlacementKind }) {
  const st = STAGE_PLACEMENT_GLYPH_STYLE[kind];
  const box =
    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-white/[0.12] bg-black/40";

  switch (kind) {
    case "FIXTURE":
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
    case "POWER":
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
    default:
      return null;
  }
}

export function StageDiagramLegend(props: Props) {
  const { canvas, tierHighlightLayerId } = props;
  const userDeckPolygonCount =
    canvas.deckPolygons?.filter((p) => p.id !== SYNTHETIC_DECK_RECT_POLYGON_ID).length ?? 0;
  const placementHistogram = histogramPlacementKinds(canvas.placements);
  const trussSymbolCount = placementHistogram.get("TRUSS") ?? 0;
  const fixtureSymbolCount = placementHistogram.get("FIXTURE") ?? 0;

  const usedKinds = new Set(canvas.placements.map((p) => p.kind));
  const placementKindsOrdered = STAGE_DESIGN_PLACEMENT_KIND_ORDER.filter((k) => usedKinds.has(k));

  const shapeHistogram = histogramShapeKinds(canvas.shapes);
  const usedShapeKinds = new Set(canvas.shapes.map((s) => s.kind));
  const shapeKindsOrdered = STAGE_DESIGN_SHAPE_KIND_ORDER.filter((k) => usedShapeKinds.has(k));

  const equipmentLegend = summarizeEquipmentMetadataForLegend(canvas.placements);

  const equipmentSubtitleFragments = (() => {
    if (equipmentLegend.annotatedCount === 0) return [] as string[];
    const frag: string[] = [];
    if (equipmentLegend.symbolsWithCueRole > 0) {
      frag.push(
        `${equipmentLegend.symbolsWithCueRole} cue label${equipmentLegend.symbolsWithCueRole === 1 ? "" : "s"}`,
      );
    }
    if (equipmentLegend.symbolsWithDmxPair > 0) {
      frag.push(
        `${equipmentLegend.symbolsWithDmxPair} paired DMX on fixtures & LED surfaces (U·ch in SVG titles)`,
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

  if (placementKindsOrdered.length === 0 && shapeKindsOrdered.length === 0) return null;

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
              <span className="text-uls-subtle"> — drawn on plot</span>
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
          . Producer <span className="font-medium text-uls-subtle">Plot BOM CSV</span> carries cue/DMX columns for symbols plus
          shape anchors (see export row).
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
              ({fixtureSymbolCount} lighting fixture{fixtureSymbolCount === 1 ? "" : "s"}) lists fixture symbols only — no shapes
              or deck tables.
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
              <span className="font-medium text-uls-subtle">{fixtureSymbolCount}</span> lighting fixture
              {fixtureSymbolCount === 1 ? "" : "s"} on plot (symbols only; no shapes or deck tables).
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
    </div>
  );
}

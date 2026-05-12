import type { StageDesignFootprint, StageDesignPlotMargins } from "@/lib/stage-design-canvas";
import type { StageDesignUnit } from "@prisma/client";

export type StageDiagramDimensionReadoutsProps = {
  footprint: StageDesignFootprint;
  plotMargins: StageDesignPlotMargins;
  unit: StageDesignUnit;
  deckPolygonCount: number;
  /** Producer wording references the form above; portal wording is director-facing read-only copy. */
  audience: "producer" | "portal";
  /** Container spacing / width (Tailwind); include `space-y-1` for vertical rhythm between the two rows. */
  className: string;
};

/** Nominal deck size + plot margins (FOH/upstage/wings) beside the footprint preview — producer and portal parity. */
export function StageDiagramDimensionReadouts(props: StageDiagramDimensionReadoutsProps) {
  const { footprint, plotMargins, unit, deckPolygonCount, audience, className } = props;
  const unitLabel = unit === "METERS" ? "m" : "ft";
  const w = (Number.isFinite(footprint.width) ? footprint.width : 0).toFixed(2);
  const dep = (Number.isFinite(footprint.depth) ? footprint.depth : 0).toFixed(2);

  const deckSubtitle =
    audience === "producer"
      ? deckPolygonCount > 0
        ? " — extents follow drawn deck modules; clear modules to set width and depth in the form above."
        : " — adjust in the form above; margins extend the drawable plot."
      : deckPolygonCount > 0
        ? " — outlines may use several deck modules."
        : null;

  const marginSubtitle =
    audience === "producer"
      ? " — working area past the deck; edit in the section above."
      : " — working area drawn around the deck.";

  return (
    <div className={className}>
      <p>
        <span className="font-medium text-uls-text">Nominal deck</span>{" "}
        <span className="tabular-nums">
          {w} × {dep} {unitLabel}
        </span>
        {deckSubtitle ? <span className="text-uls-subtle">{deckSubtitle}</span> : null}
      </p>
      <p>
        <span className="font-medium text-uls-text">Plot margins</span>{" "}
        <span className="tabular-nums">
          downstage {plotMargins.downstage.toFixed(2)} · upstage {plotMargins.upstage.toFixed(2)} · stage left{" "}
          {plotMargins.stageLeft.toFixed(2)} · stage right {plotMargins.stageRight.toFixed(2)} {unitLabel}
        </span>
        <span className="text-uls-subtle">{marginSubtitle}</span>
      </p>
    </div>
  );
}

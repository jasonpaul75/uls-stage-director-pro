import type { DxfBinaryPair } from "./stage-design-dxf-binary";

export type DxfMleaderParseResult = {
  leaderLines: { x: number; y: number }[][];
  labels: string[];
  fields: Map<number, string>;
  next: number;
};

const MLEADER_SECTION_OPEN = new Set(["CONTEXT_DATA{", "LEADER{", "LEADER_LINE{"]);
const MLEADER_SECTION_CLOSE = "}";

function parseNum(raw: string): number | undefined {
  const v = Number(String(raw).trim());
  return Number.isFinite(v) ? v : undefined;
}

function isMleaderStructuralMarker(code: number, value: string): boolean {
  const v = value.trim();
  if (code === 300 || code === 302 || code === 304) return MLEADER_SECTION_OPEN.has(v);
  if (code === 301 || code === 303 || code === 305) return v === MLEADER_SECTION_CLOSE;
  return false;
}

/**
 * Parse nested MLEADER CONTEXT_DATA / LEADER / LEADER_LINE sections (atlight.github.io DXF notes).
 * Collects 10/20 vertices only inside LEADER_LINE blocks; 300/302/304 strings become labels.
 */
export function consumeDxfMleaderEntityAt(
  pairs: readonly DxfBinaryPair[],
  start: number,
): DxfMleaderParseResult {
  let j = start;
  let pendingX: number | undefined;
  let inLeaderLine = false;
  let currentLine: { x: number; y: number }[] | null = null;
  const leaderLines: { x: number; y: number }[][] = [];
  const labels: string[] = [];
  const fields = new Map<number, string>();

  const flushLine = (): void => {
    if (currentLine && currentLine.length >= 2) leaderLines.push(currentLine);
    currentLine = null;
    inLeaderLine = false;
    pendingX = undefined;
  };

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;

    if (p.code === 304 && p.value === "LEADER_LINE{") {
      flushLine();
      inLeaderLine = true;
      currentLine = [];
      j++;
      continue;
    }

    if (p.code === 305 && p.value.trim() === MLEADER_SECTION_CLOSE) {
      flushLine();
      j++;
      continue;
    }

    if (isMleaderStructuralMarker(p.code, p.value)) {
      j++;
      continue;
    }

    if (inLeaderLine && p.code === 10) {
      pendingX = parseNum(p.value);
    } else if (inLeaderLine && p.code === 20) {
      if (pendingX !== undefined && currentLine) {
        const y = parseNum(p.value);
        if (y !== undefined) currentLine.push({ x: pendingX, y });
        pendingX = undefined;
      }
    } else if ((p.code === 300 || p.code === 302 || p.code === 304) && p.value.trim().length > 0) {
      labels.push(p.value.trim());
    } else if (p.code !== 10 && p.code !== 20) {
      fields.set(p.code, p.value);
    }

    j++;
  }

  if (inLeaderLine) flushLine();

  return { leaderLines, labels, fields, next: j };
}

export function dxfMleaderLabelFromParse(labels: readonly string[], fields: ReadonlyMap<number, string>): string {
  const fromLabel = labels.find((t) => t.trim().length > 0)?.trim();
  if (fromLabel) return fromLabel.slice(0, 400);
  const from1 = fields.get(1)?.trim();
  if (from1) return from1.slice(0, 400);
  return "";
}

export function dxfMleaderTextPositionFromParse(
  fields: ReadonlyMap<number, string>,
  leaderLines: readonly { x: number; y: number }[][],
): { x: number; y: number } | null {
  const x = Number(fields.get(11) ?? fields.get(212) ?? fields.get(10));
  const y = Number(fields.get(21) ?? fields.get(222) ?? fields.get(20));
  if (Number.isFinite(x * y)) return { x, y };
  for (const line of leaderLines) {
    const last = line.at(-1);
    if (last) return last;
  }
  return null;
}

export function dxfMleaderRotationDegFromFields(fields: ReadonlyMap<number, string>): number {
  const rotRad = Number(fields.get(50));
  if (!Number.isFinite(rotRad)) return 0;
  return Math.round(((rotRad * 180) / Math.PI) * 10_000) / 10_000;
}

/** DXF MTEXT field body `%< … >%` → short readable token for diagram labels (best-effort). */
function summarizeMtextFieldInner(inner: string): string {
  const decoded = inner.trim().replace(/%22/g, '"').replace(/%27/g, "'");
  if (!decoded) return "";

  const propertyMatch = decoded.match(/Property\s*\(\s*"?([^")]+)"?\s*\)/i);
  if (propertyMatch?.[1]) {
    const prop = propertyMatch[1].replace(/^%22|%22$/g, "").trim();
    if (prop.length > 0) return prop.slice(0, 200);
  }

  const sheetSetMatch = decoded.match(/AcSheetSet[^"]*"([^"]+)"/i);
  if (sheetSetMatch?.[1]) return sheetSetMatch[1].trim().slice(0, 200);

  const formatMatch =
    decoded.match(/Format\s*\(\s*"?%22([^%"]+)%22"?\s*\)/i) ??
    decoded.match(/Format\s*\(\s*"([^"]+)"\s*\)/i);
  if (formatMatch?.[1]) return formatMatch[1].trim().slice(0, 200);

  const acSmMatch = decoded.match(/AcSm([A-Za-z][A-Za-z0-9]*)/);
  if (acSmMatch?.[1]) {
    const spaced = acSmMatch[1].replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();
    if (spaced.length > 0) return spaced.slice(0, 200);
  }

  const quoted = [...decoded.matchAll(/"([^"]*)"/g)]
    .map((m) => m[1]?.trim())
    .filter((q): q is string => typeof q === "string" && q.length > 0);
  const pick = quoted.find((q) => q.length <= 200);
  if (pick) return pick.slice(0, 200);

  const flat = decoded.replace(/\\[A-Za-z]{2,12}/g, " ").replace(/\s+/g, " ").trim();
  return flat.slice(0, 140);
}

/** Replace `%< … >%` field wrappers with summarized literals (non-recursive scan). */
function replaceMtextFieldChunks(raw: string): string {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const open = raw.indexOf("%<", i);
    if (open < 0) {
      out += raw.slice(i);
      break;
    }
    out += raw.slice(i, open);
    const close = raw.indexOf(">%", open + 2);
    if (close < 0) {
      out += raw.slice(open);
      break;
    }
    const inner = raw.slice(open + 2, close);
    out += summarizeMtextFieldInner(inner);
    i = close + 2;
  }
  return out;
}

/** Internal diagram TEXT storage: MTEXT column break (`\\N`) — distinct from paragraph newline (`\\P`). */
export const MTEXT_DIAGRAM_COLUMN_BREAK = "\v";

function tidyLogicalLine(line: string): string {
  let x = line.replace(/^[ ]+/, "").replace(/[ ]+$/, "");
  x = x.replace(/ +/g, " ");
  x = x.replace(/\t+/g, "\t");
  return x;
}

/** AutoCAD `\S numerator#denominator;` or `\S numerator^denominator;` → readable fraction text. */
export function decodeMtextStackedFractions(raw: string): string {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\" && (raw[i + 1] === "S" || raw[i + 1] === "s")) {
      let j = i + 2;
      while (j < raw.length && raw[j] !== ";") j++;
      if (j >= raw.length) {
        out += raw[i];
        i++;
        continue;
      }
      const body = raw.slice(i + 2, j);
      const hash = body.indexOf("#");
      const caret = body.indexOf("^");
      let decoded = body;
      if (hash >= 0) {
        decoded = `${body.slice(0, hash).trim()}⁄${body.slice(hash + 1).trim()}`;
      } else if (caret >= 0) {
        decoded = `${body.slice(0, caret).trim()}/${body.slice(caret + 1).trim()}`;
      }
      out += decoded;
      i = j + 1;
      continue;
    }
    out += raw[i];
    i++;
  }
  return out;
}

/** `\U+2205` style escapes → Unicode code points. */
export function decodeMtextUnicodeEscapes(raw: string): string {
  return raw.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex: string) => {
    const cp = Number.parseInt(hex, 16);
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
  });
}

function stripMtextInlineDirectiveCodes(raw: string): string {
  let s = raw;
  s = s.replace(/\\column\{[^}]*\}/gi, "");
  s = s.replace(/\\px[^;]*;/gi, "");
  s = s.replace(/\\pt[^;]*;/gi, "");
  s = s.replace(/\\p[^;]*;/gi, "");
  s = s.replace(/\\f[^;]*;/gi, "");
  s = s.replace(/\\F[^;]*;/gi, "");
  s = s.replace(/\\C\d*;/gi, "");
  s = s.replace(/\\H[^;]*;/gi, "");
  s = s.replace(/\\W[^;]*;/gi, "");
  s = s.replace(/\\Q-?\d*\.?\d*;/gi, "");
  s = s.replace(/\\T[^;]*;/gi, "");
  s = s.replace(/\\A\d*;/gi, "");
  s = s.replace(/\\M\+[0-9A-Fa-f]+;?/gi, "");
  s = s.replace(/\\[LlOoKk]/g, "");
  s = s.replace(/\\(?!S)[A-Za-z][^\\;]*;/g, "");
  return s;
}

/**
 * Normalize DXF MTEXT for diagram TEXT storage: preserve paragraph/column breaks and tabs,
 * decode stacked fractions and Unicode escapes, unwrap fields (`%<…>%`), strip font/layout directives.
 */
export function stripMinimalMtextMarkup(raw: string): string {
  let s = raw.replace(/\r\n|\r|\n/g, "\n");

  s = replaceMtextFieldChunks(s);
  s = decodeMtextStackedFractions(s);
  s = stripMtextInlineDirectiveCodes(s);
  s = decodeMtextUnicodeEscapes(s);

  s = s.replace(/\\~/g, " ");
  s = s.replace(/\\N/gi, MTEXT_DIAGRAM_COLUMN_BREAK);
  s = s.replace(/\\t/g, "\t");
  s = s.replace(/\\P/gi, "\n");
  s = s.replace(/\\\\/g, "\\");

  s = s.replace(/\{|\}/g, "");

  const lines = s.split("\n").map((ln) => tidyLogicalLine(ln));
  while (lines.length > 0 && lines[0]!.trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();

  return lines.join("\n").trim();
}

/** Human-readable label for SVG `<title>` / lists (column breaks → tab columns). */
export function formatDiagramTextLabelForDisplay(label: string): string {
  return label.replace(/\v/g, "\t");
}

/**
 * Encode diagram TEXT for DXF MTEXT export: paragraph newlines → `\\P`, column breaks → `\\N`,
 * optional `\\column{N}` prefix when multiple columns appear on a row.
 */
export function encodeMinimalMtextForExport(raw: string, max = 400): string {
  const normalized = raw.replace(/\r\n|\r/g, "\n");
  const rows = normalized.split("\n");
  let maxCols = 1;
  const splitRows: string[][] = [];
  for (const row of rows) {
    const cells = row.split(MTEXT_DIAGRAM_COLUMN_BREAK);
    maxCols = Math.max(maxCols, cells.length);
    splitRows.push(cells);
  }

  let out = maxCols > 1 ? `\\column{${maxCols}}` : "";
  for (let ri = 0; ri < splitRows.length; ri++) {
    if (ri > 0) out += "\\P";
    const cells = splitRows[ri] ?? [];
    for (let ci = 0; ci < cells.length; ci++) {
      if (ci > 0) out += "\\N";
      out += (cells[ci] ?? "")
        .replace(/\t/g, "\\t")
        .replace(/\{/g, "")
        .replace(/\}/g, "");
    }
  }

  return out.trim().slice(0, max);
}

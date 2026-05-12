/** DXF MTEXT field body `%< … >%` → short readable token for diagram labels (best-effort). */
function summarizeMtextFieldInner(inner: string): string {
  const decoded = inner.trim().replace(/%22/g, '"').replace(/%27/g, "'");
  if (!decoded) return "";
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

function tidyLogicalLine(line: string): string {
  let x = line.replace(/^[ ]+/, "").replace(/[ ]+$/, "");
  x = x.replace(/ +/g, " ");
  x = x.replace(/\t+/g, "\t");
  return x;
}

/**
 * Normalize DXF MTEXT for diagram TEXT storage: preserve paragraph breaks (`\\P` -> newline),
 * literal tab escapes (`\\t` -> TAB), strip paragraph/font/column directive tokens, unwrap fields (`%<…>%`).
 */
export function stripMinimalMtextMarkup(raw: string): string {
  let s = raw.replace(/\r\n|\r|\n/g, "\n");

  s = replaceMtextFieldChunks(s);

  s = s.replace(/\\px[^;]*;/gi, "");
  s = s.replace(/\\pt[^;]*;/gi, "");
  s = s.replace(/\\column[^;]*;/gi, "");
  s = s.replace(/\\f[^;]*;/gi, "");

  s = s.replace(/\\t/g, "\t");
  s = s.replace(/\\P/gi, "\n");

  s = s.replace(/\{|\}/g, "");

  const lines = s.split("\n").map((ln) => tidyLogicalLine(ln));
  while (lines.length > 0 && lines[0]!.trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();

  return lines.join("\n").trim();
}

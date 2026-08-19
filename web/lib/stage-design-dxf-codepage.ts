import type { DxfBinaryPair } from "./stage-design-dxf-binary";

/** Map DXF `$DWGCODEPAGE` header values to `TextDecoder` labels (browser-supported). */
export function dxfCodePageToTextDecoderLabel(codePage: string | null | undefined): string {
  if (!codePage) return "utf-8";
  const cp = codePage.trim().toUpperCase();
  if (cp.includes("UTF-8") || cp.includes("65001")) return "utf-8";
  if (cp.includes("1252")) return "windows-1252";
  if (cp.includes("1250")) return "windows-1250";
  if (cp.includes("1251")) return "windows-1251";
  if (cp.includes("ANSI")) return "windows-1252";
  return "utf-8";
}

export function readDxfHeaderCodePageFromPairs(pairs: readonly DxfBinaryPair[]): string | null {
  for (let i = 0; i < pairs.length - 1; i++) {
    const a = pairs[i]!;
    const b = pairs[i + 1]!;
    if (a.code === 9 && a.value === "$DWGCODEPAGE") return b.value.trim();
  }
  return null;
}

export function parseDxfAsciiLinesToPairs(text: string): DxfBinaryPair[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const pairs: DxfBinaryPair[] = [];
  for (let i = 0; i < lines.length; ) {
    const rawCode = lines[i++] ?? "";
    const ct = rawCode.trim();
    if (ct.length === 0) break;
    const val = lines[i++] ?? "";
    const code = Number(ct);
    if (!Number.isFinite(code)) break;
    pairs.push({ code, value: val });
  }
  return pairs;
}

/** Decode ASCII DXF bytes using `$DWGCODEPAGE` when present (fallback UTF-8). */
export function parseDxfAsciiPairsFromBytes(bytes: Uint8Array): DxfBinaryPair[] {
  const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const utf8Pairs = parseDxfAsciiLinesToPairs(utf8Text);
  const codePage = readDxfHeaderCodePageFromPairs(utf8Pairs);
  const label = dxfCodePageToTextDecoderLabel(codePage);
  if (label === "utf-8") return utf8Pairs;
  const legacyText = new TextDecoder(label, { fatal: false }).decode(bytes);
  return parseDxfAsciiLinesToPairs(legacyText);
}

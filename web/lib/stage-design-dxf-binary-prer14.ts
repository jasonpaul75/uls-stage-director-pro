import type { DxfBinaryPair } from "./stage-design-dxf-binary";

const DXF_BINARY_SENTINEL = new TextEncoder().encode("AutoCAD Binary DXF\r\n\x1a\x00");

function isBinaryDxfBytes(bytes: Uint8Array): boolean {
  if (bytes.length < DXF_BINARY_SENTINEL.length) return false;
  for (let i = 0; i < DXF_BINARY_SENTINEL.length; i++) {
    if (bytes[i] !== DXF_BINARY_SENTINEL[i]) return false;
  }
  return true;
}

type DxfValueKind = "string" | "double" | "int16" | "int32" | "int64" | "binary";

function dxfValueKindForCode(code: number): DxfValueKind {
  if (code >= 0 && code <= 9) return "string";
  if (code === 100 || code === 102 || code === 105) return "string";
  if (code >= 300 && code <= 369) return "string";
  if (code >= 999 && code <= 1009) return "string";
  if (code >= 10 && code <= 59) return "double";
  if (code >= 110 && code <= 149) return "double";
  if (code >= 210 && code <= 239) return "double";
  if (code >= 460 && code <= 469) return "double";
  if (code >= 60 && code <= 79) return "int16";
  if (code >= 170 && code <= 179) return "int16";
  if (code >= 270 && code <= 289) return "int16";
  if (code >= 370 && code <= 389) return "int16";
  if (code >= 90 && code <= 99) return "int32";
  if (code >= 420 && code <= 429) return "int32";
  if (code >= 440 && code <= 459) return "int32";
  if (code >= 160 && code <= 169) return "int64";
  if (code >= 310 && code <= 319) return "binary";
  return "string";
}

function pushInt16(out: number[], v: number): void {
  const n = v & 0xffff;
  out.push(n & 0xff, (n >> 8) & 0xff);
}

function pushInt32(out: number[], v: number): void {
  const n = v >>> 0;
  out.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
}

function pushFloat64(out: number[], v: number): void {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, v, true);
  out.push(...new Uint8Array(buf));
}

function readGroupCodePreR14(view: DataView, pos: number): { code: number; pos: number } {
  let code = view.getUint8(pos);
  pos += 1;
  if (code === 255) {
    code = view.getInt16(pos, true);
    pos += 2;
  }
  return { code, pos };
}

function readNullTerminatedString(view: DataView, pos: number, maxLen = 65536): { value: string; pos: number } {
  const start = pos;
  while (pos < view.byteLength && pos - start < maxLen && view.getUint8(pos) !== 0) pos++;
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start, pos - start);
  if (pos < view.byteLength) pos += 1;
  return { value: new TextDecoder("latin1", { fatal: false }).decode(bytes), pos };
}

function readPreR14BinaryValue(
  view: DataView,
  pos: number,
  code: number,
): { value: string; pos: number } {
  const kind = dxfValueKindForCode(code);
  if (kind === "double") {
    return { value: String(view.getFloat64(pos, true)), pos: pos + 8 };
  }
  if (kind === "int16") {
    return { value: String(view.getInt16(pos, true)), pos: pos + 2 };
  }
  if (kind === "int32") {
    return { value: String(view.getInt32(pos, true)), pos: pos + 4 };
  }
  if (kind === "int64") {
    const lo = view.getUint32(pos, true);
    const hi = view.getInt32(pos + 4, true);
    return { value: String(hi * 2 ** 32 + lo), pos: pos + 8 };
  }
  if (kind === "binary") {
    const len = view.getUint8(pos);
    return { value: "", pos: pos + 1 + len };
  }
  return readNullTerminatedString(view, pos);
}

function writeGroupCodePreR14(out: number[], code: number): void {
  if (code > 254) {
    out.push(255);
    pushInt16(out, code);
    return;
  }
  out.push(code);
}

function writePreR14BinaryValue(out: number[], code: number, value: string): void {
  const kind = dxfValueKindForCode(code);
  if (kind === "double") {
    pushFloat64(out, Number(value));
    return;
  }
  if (kind === "int16") {
    pushInt16(out, Number.parseInt(value, 10) || 0);
    return;
  }
  if (kind === "int32") {
    pushInt32(out, Number.parseInt(value, 10) || 0);
    return;
  }
  if (kind === "int64") {
    const n = BigInt(value || "0");
    pushInt32(out, Number(n & BigInt(0xffffffff)));
    pushInt32(out, Number(n >> BigInt(32)));
    return;
  }
  if (kind === "binary") {
    out.push(0);
    return;
  }
  const bytes = new TextEncoder().encode(value);
  out.push(...bytes, 0);
}

/** Pre-R14 binary DXF uses 1-byte group codes and NULL-terminated strings. */
export function parseDxfBinaryPairsPreR14(bytes: Uint8Array): DxfBinaryPair[] {
  if (!isBinaryDxfBytes(bytes)) {
    throw new Error("Not a binary DXF file (missing AutoCAD Binary DXF sentinel).");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = DXF_BINARY_SENTINEL.length;
  const out: DxfBinaryPair[] = [];
  while (pos < bytes.length) {
    const codePart = readGroupCodePreR14(view, pos);
    pos = codePart.pos;
    if (pos >= bytes.length) break;
    const valPart = readPreR14BinaryValue(view, pos, codePart.code);
    pos = valPart.pos;
    out.push({ code: codePart.code, value: valPart.value });
    if (codePart.code === 0 && valPart.value === "EOF") break;
  }
  return out;
}

/** Encode pairs as pre-R14 binary DXF (for tests and round-trip checks). */
export function encodeDxfBinaryPairsPreR14(pairs: readonly DxfBinaryPair[]): Uint8Array {
  const out: number[] = [...DXF_BINARY_SENTINEL];
  for (const pair of pairs) {
    writeGroupCodePreR14(out, pair.code);
    writePreR14BinaryValue(out, pair.code, pair.value);
  }
  return new Uint8Array(out);
}

export function isSaneDxfPairStream(pairs: readonly DxfBinaryPair[]): boolean {
  if (pairs.length < 4) return false;
  const hasSection = pairs.some((p) => p.code === 0 && p.value === "SECTION");
  const hasEof = pairs.some((p) => p.code === 0 && p.value === "EOF");
  return hasSection && hasEof;
}

/** Sniff 1-byte vs 2-byte binary group codes after the sentinel. */
export function detectDxfBinaryGroupCodeWidth(bytes: Uint8Array): "1" | "2" {
  if (!isBinaryDxfBytes(bytes) || bytes.length < DXF_BINARY_SENTINEL.length + 8) return "2";
  const p = DXF_BINARY_SENTINEL.length;
  if (bytes[p] === 0 && bytes[p + 1] === 0x53 && bytes[p + 2] === 0x45 && bytes[p + 3] === 0x43) {
    return "1";
  }
  if (bytes[p] === 0 && bytes[p + 1] === 0 && bytes[p + 2]! >= 5 && bytes[p + 3] === 0x53) {
    return "2";
  }
  try {
    const pre = parseDxfBinaryPairsPreR14(bytes);
    if (isSaneDxfPairStream(pre)) return "1";
  } catch {
    /* fall through */
  }
  return "2";
}

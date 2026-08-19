import { parseDxfAsciiPairsFromBytes } from "./stage-design-dxf-codepage";
import {
  detectDxfBinaryGroupCodeWidth,
  encodeDxfBinaryPairsPreR14,
  parseDxfBinaryPairsPreR14,
} from "./stage-design-dxf-binary-prer14";

export type DxfBinaryPair = { code: number; value: string };

export { detectDxfBinaryGroupCodeWidth, encodeDxfBinaryPairsPreR14 };

export const DXF_BINARY_SENTINEL = new TextEncoder().encode("AutoCAD Binary DXF\r\n\x1a\x00");

export function isBinaryDxfBytes(bytes: Uint8Array): boolean {
  if (bytes.length < DXF_BINARY_SENTINEL.length) return false;
  for (let i = 0; i < DXF_BINARY_SENTINEL.length; i++) {
    if (bytes[i] !== DXF_BINARY_SENTINEL[i]) return false;
  }
  return true;
}

export function isBinaryDxfTextPrefix(text: string): boolean {
  return text.startsWith("AutoCAD Binary DXF");
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

function readModularByteCount(view: DataView, pos: number): { count: number; pos: number } {
  let count = view.getUint8(pos);
  pos += 1;
  if (count === 255) {
    count = view.getUint16(pos, true);
    pos += 2;
    if (count === 255) {
      count = view.getUint32(pos, true);
      pos += 4;
    }
  }
  return { count, pos };
}

function readGroupCode(view: DataView, pos: number): { code: number; pos: number } {
  let code = view.getInt16(pos, true);
  pos += 2;
  if (code === 255) {
    code = view.getInt16(pos, true);
    pos += 2;
  }
  return { code, pos };
}

function writeGroupCode(out: number[], code: number): void {
  if (code > 255 || code === 255) {
    pushInt16(out, 255);
    pushInt16(out, code);
    return;
  }
  pushInt16(out, code);
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

function writeModularByteCount(out: number[], count: number): void {
  if (count < 255) {
    out.push(count);
    return;
  }
  if (count < 65535) {
    out.push(255);
    pushInt16(out, count);
    return;
  }
  out.push(255);
  pushInt16(out, 255);
  pushInt32(out, count);
}

function readBinaryValue(view: DataView, pos: number, code: number): { value: string; pos: number } {
  const kind = dxfValueKindForCode(code);
  if (kind === "double") {
    const value = String(view.getFloat64(pos, true));
    return { value, pos: pos + 8 };
  }
  if (kind === "int16") {
    const value = String(view.getInt16(pos, true));
    return { value, pos: pos + 2 };
  }
  if (kind === "int32") {
    const value = String(view.getInt32(pos, true));
    return { value, pos: pos + 4 };
  }
  if (kind === "int64") {
    const lo = view.getUint32(pos, true);
    const hi = view.getInt32(pos + 4, true);
    const value = String(hi * 2 ** 32 + lo);
    return { value, pos: pos + 8 };
  }
  if (kind === "binary") {
    const lenPart = readModularByteCount(view, pos);
    pos = lenPart.pos + lenPart.count;
    return { value: "", pos };
  }
  const lenPart = readModularByteCount(view, pos);
  pos = lenPart.pos;
  const bytes = new Uint8Array(view.buffer, view.byteOffset + pos, lenPart.count);
  pos += lenPart.count;
  const value = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return { value, pos };
}

function writeBinaryValue(out: number[], code: number, value: string): void {
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
    writeModularByteCount(out, 0);
    return;
  }
  const bytes = new TextEncoder().encode(value);
  writeModularByteCount(out, bytes.length);
  out.push(...bytes);
}

/** Decode AutoCAD binary DXF (R14+ 2-byte or pre-R14 1-byte group codes) into code/value pairs. */
export function parseDxfBinaryPairs(bytes: Uint8Array): DxfBinaryPair[] {
  if (!isBinaryDxfBytes(bytes)) {
    throw new Error("Not a binary DXF file (missing AutoCAD Binary DXF sentinel).");
  }
  const width = detectDxfBinaryGroupCodeWidth(bytes);
  if (width === "1") return parseDxfBinaryPairsPreR14(bytes);
  return parseDxfBinaryPairsR14(bytes);
}

function parseDxfBinaryPairsR14(bytes: Uint8Array): DxfBinaryPair[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = DXF_BINARY_SENTINEL.length;
  const out: DxfBinaryPair[] = [];
  while (pos + 2 <= bytes.length) {
    const codePart = readGroupCode(view, pos);
    pos = codePart.pos;
    if (pos >= bytes.length) break;
    const valPart = readBinaryValue(view, pos, codePart.code);
    pos = valPart.pos;
    out.push({ code: codePart.code, value: valPart.value });
    if (codePart.code === 0 && valPart.value === "EOF") break;
  }
  return out;
}

/** Encode pairs as binary DXF (for tests and round-trip checks). */
export function encodeDxfBinaryPairs(pairs: readonly DxfBinaryPair[]): Uint8Array {
  const out: number[] = [...DXF_BINARY_SENTINEL];
  for (const pair of pairs) {
    writeGroupCode(out, pair.code);
    writeBinaryValue(out, pair.code, pair.value);
  }
  return new Uint8Array(out);
}

export type ParseDxfFileToPairsResult =
  | { ok: true; pairs: DxfBinaryPair[]; format: "ascii" | "binary" }
  | { ok: false; error: string };

function toUint8Array(input: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new TextEncoder().encode(input);
}

/** Parse ASCII or binary DXF bytes/text into unified code/value pairs. */
export function parseDxfFileToPairs(input: string | ArrayBuffer | Uint8Array): ParseDxfFileToPairsResult {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.length === 0) return { ok: false, error: "DXF file is empty." };
    if (isBinaryDxfTextPrefix(trimmed)) {
      return {
        ok: false,
        error:
          "Binary DXF detected — open the file as bytes (not UTF-8 text). Re-save as ASCII DXF in CAD if import still fails.",
      };
    }
    const lines = trimmed.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
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
    if (pairs.length < 8) return { ok: false, error: "DXF file is too short to parse." };
    return { ok: true, pairs, format: "ascii" };
  }

  const bytes = toUint8Array(input);
  if (bytes.length === 0) return { ok: false, error: "DXF file is empty." };
  if (!isBinaryDxfBytes(bytes)) {
    try {
      const pairs = parseDxfAsciiPairsFromBytes(bytes);
      if (pairs.length >= 8) return { ok: true, pairs, format: "ascii" };
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
      if (text.length > 0 && !isBinaryDxfTextPrefix(text)) {
        return parseDxfFileToPairs(text);
      }
    } catch {
      /* fall through */
    }
    return {
      ok: false,
      error:
        "Unrecognized DXF format — expects ASCII DXF or AutoCAD binary DXF (sentinel “AutoCAD Binary DXF”).",
    };
  }
  try {
    const pairs = parseDxfBinaryPairs(bytes);
    if (pairs.length < 8) return { ok: false, error: "Binary DXF file is too short to parse." };
    return { ok: true, pairs, format: "binary" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Binary DXF parse failed.";
    return { ok: false, error: msg };
  }
}

#!/usr/bin/env node
/**
 * Build-time: HarfBuzz subset of Roboto for diagram PDF labels.
 * Output: public/fonts/ULSDiagramSans-subset.ttf
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import subsetFont from "subset-font";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const BASE_CHARSET =
  " \t\n\r" +
  "0123456789" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  "'\"-–—·/\\()[]{}@#$%&*+=<>?;:,.°`~_|" +
  "éèêëáàâäíìîïóòôöúùûüñçßÉÈÊËÁÀÂÄÍÌÎÏÓÒÔÖÚÙÛÜÑÇ";

const sourcePath = join(root, "public/fonts/Roboto-Regular.ttf");
const outPath = join(root, "public/fonts/ULSDiagramSans-subset.ttf");

const input = await readFile(sourcePath);
const subset = await subsetFont(input, BASE_CHARSET, { targetFormat: "sfnt" });
await writeFile(outPath, subset);
console.log(`Wrote ${outPath} (${subset.length} bytes) for ${BASE_CHARSET.length} code points.`);

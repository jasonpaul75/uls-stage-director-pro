import { describe, expect, it } from "vitest";

import { peaksFromChannelData } from "./show-media-waveform-peaks";

describe("peaksFromChannelData", () => {
  it("chunks into requested buckets using max magnitude", () => {
    const f = new Float32Array([0.1, -0.9, 0.2, 0.01]);
    const p = peaksFromChannelData(f, 2);
    expect(p[0]).toBeCloseTo(0.9, 5);
    expect(p[1]).toBeCloseTo(0.2, 5);
  });

  it("returns empty for empty samples", () => {
    expect(peaksFromChannelData(new Float32Array(0), 10)).toEqual([]);
  });
});

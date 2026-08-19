import { describe, expect, it } from "vitest";

import {
  faceIndicesFromVertexFields,
  polygonMeshGridLoops,
  resolvePolyfaceMeshLoops,
} from "./stage-design-dxf-polyline-mesh";

describe("faceIndicesFromVertexFields", () => {
  it("reads 1-based indices and duplicates a third index for triangles", () => {
    const fields = new Map<number, string>([
      [71, "1"],
      [72, "3"],
      [73, "4"],
    ]);
    expect(faceIndicesFromVertexFields(fields)).toEqual([1, 3, 4, 4]);
  });

  it("uses absolute values when edge visibility is flagged negative", () => {
    const fields = new Map<number, string>([
      [71, "-2"],
      [72, "4"],
      [73, "-1"],
      [74, "3"],
    ]);
    expect(faceIndicesFromVertexFields(fields)).toEqual([2, 4, 1, 3]);
  });
});

describe("resolvePolyfaceMeshLoops", () => {
  it("builds face loops from coordinate vertices and face records", () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ];
    const loops = resolvePolyfaceMeshLoops(verts, [[1, 2, 3, 4]]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toEqual(verts);
  });
});

describe("polygonMeshGridLoops", () => {
  it("emits one quad loop per grid cell", () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ];
    const loops = polygonMeshGridLoops(2, 2, verts);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 10, y: 5 },
      { x: 10, y: 0 },
    ]);
  });
});

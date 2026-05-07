import { describe, expect, it } from "vitest";

import { computeShowMediaAdjacentSwap } from "./show-media-adjacent-reorder";

describe("computeShowMediaAdjacentSwap", () => {
  const n = [
    { id: "a", sortOrder: 0 },
    { id: "b", sortOrder: 1 },
    { id: "c", sortOrder: 2 },
  ];

  it("returns null when item not in list", () => {
    expect(computeShowMediaAdjacentSwap(n, "x", "up")).toBeNull();
  });

  it("returns null at top when moving up", () => {
    expect(computeShowMediaAdjacentSwap(n, "a", "up")).toBeNull();
  });

  it("returns null at bottom when moving down", () => {
    expect(computeShowMediaAdjacentSwap(n, "c", "down")).toBeNull();
  });

  it("swaps order values with upper neighbor", () => {
    expect(computeShowMediaAdjacentSwap(n, "b", "up")).toEqual({
      idA: "b",
      idB: "a",
      sortOrderForA: 0,
      sortOrderForB: 1,
    });
  });

  it("swaps order values with lower neighbor", () => {
    expect(computeShowMediaAdjacentSwap(n, "b", "down")).toEqual({
      idA: "b",
      idB: "c",
      sortOrderForA: 2,
      sortOrderForB: 1,
    });
  });
});

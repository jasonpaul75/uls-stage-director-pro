import { describe, expect, it } from "vitest";

import { prisma } from "./prisma";

describe("prisma singleton", () => {
  it("exports a stable Prisma client and expected surface", async () => {
    const mod = await import("./prisma");
    expect(prisma).toBe(mod.prisma);
    expect(typeof prisma.$connect).toBe("function");
    expect(typeof prisma.$disconnect).toBe("function");
  });
});

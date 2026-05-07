import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
}));

vi.mock("@/auth", () => ({
  handlers: { GET: mocks.GET, POST: mocks.POST },
}));

describe("NextAuth route handler exports", () => {
  it("re-exports GET and POST from @/auth handlers", async () => {
    const { GET, POST } = await import("./route");
    expect(GET).toBe(mocks.GET);
    expect(POST).toBe(mocks.POST);
  });
});

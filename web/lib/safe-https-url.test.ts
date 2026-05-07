import { describe, expect, it } from "vitest";

import { parseHttpsUrl } from "./safe-https-url";

describe("parseHttpsUrl", () => {
  it("returns normalized https URL when valid", () => {
    expect(parseHttpsUrl("  https://smug.example/path?q=1 ")).toBe("https://smug.example/path?q=1");
  });

  it("rejects blank, too long, non-https, or invalid", () => {
    expect(parseHttpsUrl("")).toBeNull();
    expect(parseHttpsUrl("  \t")).toBeNull();
    expect(parseHttpsUrl("http://x.com/")).toBeNull();
    expect(parseHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpsUrl("not a url")).toBeNull();
    expect(parseHttpsUrl(`https://x.com/${"a".repeat(2100)}`)).toBeNull();
  });

  it("normalizes casing for scheme and host", () => {
    expect(parseHttpsUrl("HTTPS://EXAMPLE.COM/foo")).toBe("https://example.com/foo");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let captured: Record<string, unknown> | null = null;

  const NextAuthFn = vi.fn((config: Record<string, unknown>) => {
    captured = config;
    return {
      handlers: {},
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    };
  });

  const CredentialsFn = vi.fn((opts: Record<string, unknown>) => opts);

  const lib = {
    authorizeCredentials: vi.fn(),
    mergeCredentialsIntoJwt: vi.fn(),
    mergeJwtIntoSession: vi.fn(),
  };

  return {
    NextAuthFn,
    CredentialsFn,
    lib,
    getCaptured: () => captured as Record<string, unknown> | null,
    clearCaptured: () => {
      captured = null;
    },
  };
});

vi.mock("next-auth", () => ({ default: mocks.NextAuthFn }));
vi.mock("next-auth/providers/credentials", () => ({ default: mocks.CredentialsFn }));
vi.mock("@/lib/auth/authorize-credentials", () => ({
  authorizeCredentials: mocks.lib.authorizeCredentials,
}));
vi.mock("@/lib/auth/next-auth-credential-bridge", () => ({
  mergeCredentialsIntoJwt: mocks.lib.mergeCredentialsIntoJwt,
  mergeJwtIntoSession: mocks.lib.mergeJwtIntoSession,
}));

describe("auth (NextAuth wiring)", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.NextAuthFn.mockClear();
    mocks.CredentialsFn.mockClear();
    mocks.clearCaptured();
    mocks.lib.authorizeCredentials.mockReset();
    mocks.lib.mergeCredentialsIntoJwt.mockReset();
    mocks.lib.mergeJwtIntoSession.mockReset();
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
  });

  async function loadAuth(): Promise<void> {
    await import("./auth");
  }

  it("calls NextAuth with trustHost and jwt session, using AUTH_SECRET", async () => {
    process.env.AUTH_SECRET = "from-auth-secret";
    await loadAuth();

    expect(mocks.getCaptured()?.trustHost).toBe(true);
    expect(mocks.getCaptured()?.secret).toBe("from-auth-secret");
    expect(mocks.getCaptured()?.session).toEqual({
      strategy: "jwt",
      maxAge: 30 * 24 * 60 * 60,
    });
    expect(mocks.CredentialsFn).toHaveBeenCalledTimes(1);
    expect(Array.isArray(mocks.getCaptured()?.providers)).toBe(true);
  });

  it("falls back secret to NEXTAUTH_SECRET when AUTH_SECRET is unset", async () => {
    process.env.NEXTAUTH_SECRET = "legacy-secret";
    await loadAuth();

    expect(mocks.getCaptured()?.secret).toBe("legacy-secret");
  });

  it("wires Credentials.authorize into authorizeCredentials", async () => {
    mocks.lib.authorizeCredentials.mockResolvedValueOnce(null);
    await loadAuth();

    const credOpts = mocks.CredentialsFn.mock.calls[0]?.[0] as Record<string, unknown>;
    const authorizeFn = credOpts.authorize as (cred?: { email?: string; password?: string }) => unknown;
    await authorizeFn({ email: "u@test.com", password: "raw" });

    expect(mocks.lib.authorizeCredentials).toHaveBeenCalledWith("u@test.com", "raw");
  });

  it("jwt and session callbacks invoke bridge helpers", async () => {
    await loadAuth();

    type Cb = Record<string, (a: Record<string, unknown>) => unknown>;
    const cb = mocks.getCaptured()?.callbacks as Cb;

    const tokenObj: Record<string, unknown> = { k: "t" };
    cb.jwt({ token: tokenObj, user: { id: "u1" } });
    expect(mocks.lib.mergeCredentialsIntoJwt).toHaveBeenCalledWith(tokenObj, { id: "u1" });

    const sessionWrap = { user: { id: "" } };
    const tokenJwt = { sub: "jwt-sub", globalRole: "DIRECTOR" };
    cb.session({ session: sessionWrap, token: tokenJwt });
    expect(mocks.lib.mergeJwtIntoSession).toHaveBeenCalledWith(sessionWrap, tokenJwt);
  });
});

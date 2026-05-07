import { describe, expect, it } from "vitest";

import { GlobalRole } from "@prisma/client";

import { mergeCredentialsIntoJwt, mergeJwtIntoSession } from "./next-auth-credential-bridge";

describe("mergeCredentialsIntoJwt", () => {
  it("no-ops without user payload", () => {
    const token: { sub?: string; globalRole?: unknown } = { sub: "keep" };
    mergeCredentialsIntoJwt(token, undefined);
    expect(token).toEqual({ sub: "keep" });
  });

  it("skips when id or globalRole is missing", () => {
    const token = {};
    mergeCredentialsIntoJwt(token, { id: null, globalRole: GlobalRole.DIRECTOR });
    expect(token).toEqual({});

    mergeCredentialsIntoJwt(token, { id: "u", globalRole: null });
    expect(token).toEqual({});
  });

  it("skips when id is empty string or globalRole is undefined", () => {
    const token: { sub?: string; globalRole?: unknown } = { sub: "keep" };
    mergeCredentialsIntoJwt(token, { id: "", globalRole: GlobalRole.DIRECTOR });
    expect(token).toEqual({ sub: "keep" });

    mergeCredentialsIntoJwt(token, { id: "u1", globalRole: undefined });
    expect(token).toEqual({ sub: "keep" });
  });

  it("writes sub and globalRole on success", () => {
    const token: { sub?: string; globalRole?: unknown } = {};
    mergeCredentialsIntoJwt(token, {
      id: "user_1",
      globalRole: GlobalRole.PRODUCER,
    });
    expect(token).toEqual({
      sub: "user_1",
      globalRole: GlobalRole.PRODUCER,
    });
  });
});

describe("mergeJwtIntoSession", () => {
  it("no-ops when session.user absent", () => {
    const session = {};
    mergeJwtIntoSession(session, { sub: "x", globalRole: GlobalRole.DIRECTOR });
    expect(session).toEqual({});
  });

  it("no-ops when token.sub absent", () => {
    const session = { user: {} as { id?: string; globalRole?: GlobalRole | undefined } };
    mergeJwtIntoSession(session, { globalRole: GlobalRole.DIRECTOR });
    expect(session.user).toEqual({});
  });

  it("no-ops when token.sub is empty string", () => {
    const session = {
      user: { id: "prior", globalRole: GlobalRole.DIRECTOR },
    };
    mergeJwtIntoSession(session, { sub: "", globalRole: GlobalRole.PRODUCER });
    expect(session.user).toEqual({ id: "prior", globalRole: GlobalRole.DIRECTOR });
  });

  it("writes user id and globalRole from token", () => {
    const session = {
      user: { id: "", globalRole: undefined as GlobalRole | undefined },
    };
    mergeJwtIntoSession(session, {
      sub: "jwt_sub",
      globalRole: GlobalRole.ULS_ADMIN,
    });

    expect(session.user).toEqual({
      id: "jwt_sub",
      globalRole: GlobalRole.ULS_ADMIN,
    });
  });

  it("casts token.globalRole onto session.user", () => {
    const session = { user: { id: "x", globalRole: undefined as GlobalRole | undefined } };
    mergeJwtIntoSession(session, { sub: "s", globalRole: "DIRECTOR" });
    expect(session.user.globalRole).toBe("DIRECTOR");
  });

  it("copies token.sub even when JWT payload omits globalRole", () => {
    const session = {
      user: {
        id: "prior",
        globalRole: GlobalRole.DIRECTOR,
      },
    };
    mergeJwtIntoSession(session, { sub: "new_sub_only" });

    expect(session.user.id).toBe("new_sub_only");
    expect(session.user.globalRole).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole } from "@prisma/client";

vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {},
}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  compareSync: vi.fn(),
}));

const gateMocks = vi.hoisted(() => ({
  directorHasActivePortalMembership: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUnique },
  },
}));

vi.mock("@/lib/director-portal-signin-gate", () => ({
  directorHasActivePortalMembership: gateMocks.directorHasActivePortalMembership,
}));

vi.mock("bcryptjs", () => ({
  compareSync: (...args: unknown[]) => mocks.compareSync(...args),
}));

import { DirectorPortalAccessEndedSignin } from "./director-portal-access-ended-signin";
import { authorizeCredentials } from "./authorize-credentials";

describe("authorizeCredentials", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.compareSync.mockReset();
    gateMocks.directorHasActivePortalMembership.mockReset();
    gateMocks.directorHasActivePortalMembership.mockResolvedValue(true);
  });

  it("returns null when email or password is not a string", async () => {
    expect(await authorizeCredentials(1, "x")).toBeNull();
    expect(await authorizeCredentials("a@b.com", null)).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("queries empty string email when passed literally", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    expect(await authorizeCredentials("", "pw")).toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { email: "" } });
  });

  it("passes empty password through to bcrypt when user exists", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "u",
      email: "e@test.com",
      name: null,
      passwordHash: "stored",
      globalRole: GlobalRole.DIRECTOR,
    });
    mocks.compareSync.mockReturnValueOnce(false);

    expect(await authorizeCredentials("e@test.com", "")).toBeNull();
    expect(mocks.compareSync).toHaveBeenCalledWith("", "stored");
  });

  it("returns null when user missing or password not set", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    expect(await authorizeCredentials("gone@test.com", "secret")).toBeNull();

    mocks.findUnique.mockResolvedValueOnce({
      id: "u_oauth",
      email: "o@test.com",
      name: null,
      passwordHash: null,
      globalRole: GlobalRole.DIRECTOR,
    });
    expect(await authorizeCredentials("o@test.com", "secret")).toBeNull();
    expect(mocks.compareSync).not.toHaveBeenCalled();
  });

  it("returns null when bcrypt compare fails", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "u@test.com",
      name: null,
      passwordHash: "$2a",
      globalRole: GlobalRole.PRODUCER,
    });
    mocks.compareSync.mockReturnValueOnce(false);

    expect(await authorizeCredentials("u@test.com", "wrong")).toBeNull();
    expect(mocks.compareSync).toHaveBeenCalledWith("wrong", "$2a");
  });

  it("looks up trimmed email but passes raw password to bcrypt", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "bob@example.com",
      name: "Bob",
      passwordHash: "$2a$x",
      globalRole: GlobalRole.DIRECTOR,
    });
    mocks.compareSync.mockReturnValueOnce(true);

    const out = await authorizeCredentials("  bob@example.com  ", "  rawPw  ");

    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { email: "bob@example.com" } });
    expect(mocks.compareSync).toHaveBeenCalledWith("  rawPw  ", "$2a$x");
    expect(out).toEqual({
      id: "u1",
      email: "bob@example.com",
      name: "Bob",
      globalRole: GlobalRole.DIRECTOR,
    });
  });

  it("maps null name to omit name on success payload", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "u2",
      email: "n@test.com",
      name: null,
      passwordHash: "h",
      globalRole: GlobalRole.DIRECTOR,
    });
    mocks.compareSync.mockReturnValueOnce(true);

    const out = await authorizeCredentials("n@test.com", "pw");

    expect(out?.name).toBeUndefined();
  });

  it("calls portal membership gate for directors after password verifies", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "u_dir",
      email: "dir@test.com",
      name: null,
      passwordHash: "h",
      globalRole: GlobalRole.DIRECTOR,
    });
    mocks.compareSync.mockReturnValueOnce(true);

    await authorizeCredentials("dir@test.com", "pw");

    expect(gateMocks.directorHasActivePortalMembership).toHaveBeenCalledWith("u_dir");
  });

  it("does not call portal gate for producers", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "u_prod",
      email: "p@test.com",
      name: null,
      passwordHash: "h",
      globalRole: GlobalRole.PRODUCER,
    });
    mocks.compareSync.mockReturnValueOnce(true);

    await authorizeCredentials("p@test.com", "pw");

    expect(gateMocks.directorHasActivePortalMembership).not.toHaveBeenCalled();
  });

  it("does not call portal gate for staff accounts", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "u_staff",
      email: "crew@test.com",
      name: "Crew",
      passwordHash: "h",
      globalRole: GlobalRole.STAFF,
    });
    mocks.compareSync.mockReturnValueOnce(true);

    await authorizeCredentials("crew@test.com", "pw");

    expect(gateMocks.directorHasActivePortalMembership).not.toHaveBeenCalled();
  });

  it("returns null when account is disabled before password check", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "u_dis",
      email: "d@test.com",
      name: null,
      passwordHash: "h",
      globalRole: GlobalRole.PRODUCER,
      disabledAt: new Date("2026-01-01T00:00:00Z"),
    });

    expect(await authorizeCredentials("d@test.com", "pw")).toBeNull();
    expect(mocks.compareSync).not.toHaveBeenCalled();
  });

  it("throws DirectorPortalAccessEndedSignin when gate denies director", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "u_exp",
      email: "old@test.com",
      name: null,
      passwordHash: "h",
      globalRole: GlobalRole.DIRECTOR,
    });
    mocks.compareSync.mockReturnValueOnce(true);
    gateMocks.directorHasActivePortalMembership.mockResolvedValueOnce(false);

    await expect(authorizeCredentials("old@test.com", "pw")).rejects.toThrow(DirectorPortalAccessEndedSignin);
  });
});

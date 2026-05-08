import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectRole } from "@prisma/client";

import { isDirectorPortalAccessRevoked } from "./director-portal-access-window";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectMember: { findMany: mocks.findMany },
  },
}));

import { directorHasActivePortalMembership } from "./director-portal-signin-gate";

describe("directorHasActivePortalMembership", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
  });

  it("returns true when the user has no director memberships (intake onboarding)", async () => {
    mocks.findMany.mockResolvedValueOnce([]);
    await expect(directorHasActivePortalMembership("u1")).resolves.toBe(true);
  });

  it("returns true when at least one membership is not past the access window", async () => {
    const recentlyConcluded = new Date("2026-03-01T12:00:00.000Z");
    expect(isDirectorPortalAccessRevoked(recentlyConcluded, new Date("2026-04-30T12:00:00.000Z"))).toBe(false);

    mocks.findMany.mockResolvedValueOnce([
      { project: { eventConclusionAt: recentlyConcluded } },
      { project: { eventConclusionAt: new Date("2020-01-01T00:00:00.000Z") } },
    ]);
    await expect(directorHasActivePortalMembership("u_mix")).resolves.toBe(true);
  });

  it("returns false when every membership is revoked", async () => {
    const concluded = new Date("2020-06-01T00:00:00.000Z");
    expect(isDirectorPortalAccessRevoked(concluded, new Date("2026-01-01T00:00:00.000Z"))).toBe(true);

    mocks.findMany.mockResolvedValueOnce([
      { project: { eventConclusionAt: concluded } },
      { project: { eventConclusionAt: concluded } },
    ]);
    await expect(directorHasActivePortalMembership("u_expired")).resolves.toBe(false);
  });

  it("returns true when conclusion is unset (production not closed out yet)", async () => {
    mocks.findMany.mockResolvedValueOnce([{ project: { eventConclusionAt: null } }]);
    await expect(directorHasActivePortalMembership("u_open")).resolves.toBe(true);
  });

  it("queries only DIRECTOR memberships", async () => {
    mocks.findMany.mockResolvedValueOnce([]);
    await directorHasActivePortalMembership("ux");
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: "ux", role: ProjectRole.DIRECTOR },
      select: { project: { select: { eventConclusionAt: true } } },
    });
  });
});

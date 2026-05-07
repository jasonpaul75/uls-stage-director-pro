import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";

import { GET } from "./route";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const projectFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findMany: projectFindMany,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  projectFindMany.mockReset();
});

describe("/producer/inbox/export GET CSV", () => {
  it("403 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null);

    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(projectFindMany).not.toHaveBeenCalled();
  });

  it("403 when user id missing even if role producer", async () => {
    authMock.mockResolvedValueOnce({ user: { globalRole: GlobalRole.PRODUCER } });

    const res = await GET();
    expect(res.status).toBe(403);
    expect(projectFindMany).not.toHaveBeenCalled();
  });

  it("403 for director persona", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });

    const res = await GET();
    expect(res.status).toBe(403);
    expect(projectFindMany).not.toHaveBeenCalled();
  });

  it.each([GlobalRole.PRODUCER, GlobalRole.ULS_ADMIN] as const)(
    "200 for allowed role — empty inbox still yields BOM + header row (%s)",
    async (globalRole) => {
      authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole } });
      projectFindMany.mockResolvedValueOnce([]);

      const res = await GET();
      expect(res.status).toBe(200);

      expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
      const disposition = res.headers.get("Content-Disposition");
      expect(disposition).toMatch(/attachment;\s*filename="uls-intake-inbox-\d{4}-\d{2}-\d{2}\.csv"/);

      const blob = Buffer.from(await res.arrayBuffer());
      expect(blob.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);

      const text = new TextDecoder("utf-8").decode(blob);

      const lines = text.trimEnd().split("\n");
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("production_id");
      expect(lines[0]).toContain("stripe_count_draft");
      expect(lines[0]).toContain("director_portal_access_state");

      expect(projectFindMany).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          where: { status: ProjectStatus.INTAKE_SUBMITTED },
          orderBy: { submittedAt: "desc" },
        }),
      );
    },
  );

  it("escapes CSV fields with commas/quotes/newlines", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.PRODUCER } });

    projectFindMany.mockResolvedValueOnce([
      {
        id: "p_esc",
        name: 'Venue Gala, Phase "A"',
        venue: `LineOne\nLineTwo`,
        cityState: "Brooklyn, NY",
        submittedAt: new Date("2026-04-05T09:22:01.234Z"),
        stripeCustomerId: null,
        assignedTo: null,
        memberships: [
          {
            role: ProjectRole.DIRECTOR,
            user: { email: "dir@example.com, backup" },
          },
        ],
        stripeInvoices: [
          {
            status: "draft",
            amountDueCents: 100,
            attemptCount: 0,
          },
          {
            status: "open",
            amountDueCents: 50,
            attemptCount: 2,
          },
        ],
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    const nl = "\n";
    const afterBom = text.startsWith("\uFEFF") ? text.slice(1) : text;
    const firstNl = afterBom.indexOf(nl);
    const dataRow = afterBom.slice(firstNl + 1).trimEnd();

    expect(dataRow).toContain('"Venue Gala, Phase ""A""');
    expect(dataRow).toMatch(/"LineOne\nLineTwo"/);
    expect(dataRow).toContain('"Brooklyn, NY"');
    expect(dataRow).toContain('"dir@example.com, backup"');
    expect(dataRow).toContain("2026-04-05T09:22:01.234Z");
    expect(dataRow.endsWith(",yes,,,no_conclusion_date")).toBe(true);
    expect(dataRow).toContain(",no,1,1,0,0,0,0,yes");
  });

  it("aggregates Stripe status counts and skips open-retry hint when unpaid open has zero attempts", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u2", globalRole: GlobalRole.ULS_ADMIN } });

    projectFindMany.mockResolvedValueOnce([
      {
        id: "p_agg",
        name: "Minimal",
        venue: "V",
        cityState: "",
        submittedAt: new Date("2020-01-01T00:00:00.000Z"),
        stripeCustomerId: "cus_x",
        assignedTo: { email: "producer@uls.com" },
        memberships: [{ role: ProjectRole.DIRECTOR, user: { email: "d@uls.com" } }],
        stripeInvoices: [
          { status: "void", amountDueCents: 0, attemptCount: 0 },
          { status: "paid", amountDueCents: 0, attemptCount: 0 },
          { status: "uncollectible", amountDueCents: 999, attemptCount: 5 },
          { status: "open", amountDueCents: 100, attemptCount: 0 },
          { status: "unknown_future", amountDueCents: 0, attemptCount: 0 },
        ],
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const dataLine = (await res.text()).trimEnd().split("\n")[1];

    const cells = dataLine.split(",");
    expect(cells.length).toBe(18);
    expect(cells[7]).toBe("yes");
    expect(cells[8]).toBe("0");
    expect(cells[9]).toBe("1");
    expect(cells[10]).toBe("1");
    expect(cells[11]).toBe("1");
    expect(cells[12]).toBe("1");
    expect(cells[13]).toBe("1");
    expect(cells[14]).toBe("no");
    expect(cells[15]).toBe("");
    expect(cells[16]).toBe("");
    expect(cells[17]).toBe("no_conclusion_date");
  });

  it("exports portal deadline and closed state when event conclusion is in the past", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
    try {
      authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.PRODUCER } });

      projectFindMany.mockResolvedValueOnce([
        {
          id: "p_past",
          name: "Wrapped",
          venue: "V",
          cityState: "",
          submittedAt: new Date("2019-01-01T00:00:00.000Z"),
          eventConclusionAt: new Date("2020-01-01T00:00:00.000Z"),
          stripeCustomerId: null,
          assignedTo: null,
          memberships: [],
          stripeInvoices: [],
        },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      const dataLine = (await res.text()).trimEnd().split("\n")[1];
      expect(dataLine).toContain("2020-01-01T00:00:00.000Z");
      expect(dataLine).toContain("2020-03-31T23:59:59.999Z");
      expect(dataLine.endsWith(",closed")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});


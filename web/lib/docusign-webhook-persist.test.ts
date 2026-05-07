import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ParsedDocuSignConnectEnvelope } from "./docusign-connect-parse";

const prismaMocks = vi.hoisted(() => ({
  findFirstInbound: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    docuSignInboundEvent: { findFirst: prismaMocks.findFirstInbound },
    $transaction: prismaMocks.transaction,
  },
}));

import {
  persistDocuSignConnectInbound,
  refreshLinkedEnvelopeFromLatestInbound,
} from "./docusign-webhook-persist";

function makeTx() {
  return {
    docuSignInboundEvent: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    projectDocuSignEnvelope: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

const ENV_ID = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";

describe("persistDocuSignConnectInbound", () => {
  it("creates audit row and skips mirror when envelope id is missing", async () => {
    const tx = makeTx();

    const out = await persistDocuSignConnectInbound(tx as never, {
      payloadHashSha256: "digest_hex",
      parsed: { event: "heartbeat" },
      extracted: null,
    });

    expect(tx.docuSignInboundEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.projectDocuSignEnvelope.findUnique).not.toHaveBeenCalled();
    expect(tx.docuSignInboundEvent.updateMany).toHaveBeenCalledWith({
      where: { payloadHashSha256: "digest_hex" },
      data: { processedAt: expect.any(Date) },
    });
    expect(out).toMatchObject({
      envelopeIdExtracted: null,
      updatedLinkedEnvelope: false,
      projectId: null,
    });
  });

  it("returns false mirror when Producer has not linked envelope id yet", async () => {
    const tx = makeTx();
    tx.projectDocuSignEnvelope.findUnique.mockResolvedValue(null);

    const extracted: ParsedDocuSignConnectEnvelope = {
      envelopeId: `  \n${ENV_ID} `,
      event: "envelope-sent",
    };

    const out = await persistDocuSignConnectInbound(tx as never, {
      payloadHashSha256: "dig2",
      parsed: {
        event: "envelope-sent",
        data: { envelopeId: ENV_ID },
      },
      extracted,
    });

    expect(tx.projectDocuSignEnvelope.findUnique).toHaveBeenCalledWith({ where: { envelopeId: ENV_ID } });
    expect(tx.projectDocuSignEnvelope.update).not.toHaveBeenCalled();
    expect(out.updatedLinkedEnvelope).toBe(false);
  });

  it("updates linked envelope and stamps completedAt once on completed transition", async () => {
    const tx = makeTx();
    tx.projectDocuSignEnvelope.findUnique.mockResolvedValue({
      id: "row_ds",
      projectId: "proj_1",
      status: "sent",
      completedAt: null,
      voidedAt: null,
    });

    const extracted: ParsedDocuSignConnectEnvelope = {
      envelopeId: ENV_ID,
      event: "envelope-completed",
    };

    const out = await persistDocuSignConnectInbound(tx as never, {
      payloadHashSha256: "dig3",
      parsed: {},
      extracted,
    });

    expect(tx.projectDocuSignEnvelope.update).toHaveBeenCalledTimes(1);
    const [call] = tx.projectDocuSignEnvelope.update.mock.calls[0];
    expect(call).toMatchObject({
      where: { id: "row_ds" },
      data: expect.objectContaining({
        status: "completed",
        lastWebhookEvent: "envelope-completed",
        completedAt: expect.any(Date),
      }),
    });
    expect(out.updatedLinkedEnvelope).toBe(true);
    expect(out.projectId).toBe("proj_1");
  });

  it("stamps voidedAt once on voided transition", async () => {
    const tx = makeTx();
    tx.projectDocuSignEnvelope.findUnique.mockResolvedValue({
      id: "row_v",
      projectId: "proj_v",
      status: "sent",
      completedAt: null,
      voidedAt: null,
    });

    const extracted: ParsedDocuSignConnectEnvelope = {
      envelopeId: ENV_ID,
      event: "envelope-voided",
    };

    await persistDocuSignConnectInbound(tx as never, {
      payloadHashSha256: "dig_void",
      parsed: {},
      extracted,
    });

    expect(tx.projectDocuSignEnvelope.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row_v" },
        data: expect.objectContaining({
          status: "voided",
          voidedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("keeps linked row status when webhook event does not infer a new status token", async () => {
    const tx = makeTx();
    tx.projectDocuSignEnvelope.findUnique.mockResolvedValue({
      id: "row_fb",
      projectId: "p_fb",
      status: "delivered",
      completedAt: null,
      voidedAt: null,
    });

    await persistDocuSignConnectInbound(tx as never, {
      payloadHashSha256: "dig_fb",
      parsed: {},
      extracted: {
        envelopeId: ENV_ID,
        event: "connect-custom-ping",
      },
    });

    expect(tx.projectDocuSignEnvelope.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row_fb" },
        data: expect.objectContaining({
          status: "delivered",
          lastWebhookEvent: "connect-custom-ping",
        }),
      }),
    );
  });

  it("does not overwrite completedAt or voidedAt once stamped", async () => {
    const priorCompleted = new Date("2020-06-01T00:00:00Z");
    const priorVoid = new Date("2020-07-01T00:00:00Z");

    const txComplete = makeTx();
    txComplete.projectDocuSignEnvelope.findUnique.mockResolvedValue({
      id: "row_done",
      projectId: "p1",
      status: "completed",
      completedAt: priorCompleted,
      voidedAt: null,
    });
    await persistDocuSignConnectInbound(txComplete as never, {
      payloadHashSha256: "dig_idem_c",
      parsed: {},
      extracted: { envelopeId: ENV_ID, event: "envelope-completed" },
    });
    const dataC = txComplete.projectDocuSignEnvelope.update.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(dataC.completedAt).toBeUndefined();

    const txVoid = makeTx();
    txVoid.projectDocuSignEnvelope.findUnique.mockResolvedValue({
      id: "row_void_done",
      projectId: "p2",
      status: "voided",
      completedAt: null,
      voidedAt: priorVoid,
    });
    await persistDocuSignConnectInbound(txVoid as never, {
      payloadHashSha256: "dig_idem_v",
      parsed: {},
      extracted: { envelopeId: ENV_ID, event: "envelope-voided" },
    });
    const dataV = txVoid.projectDocuSignEnvelope.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(dataV.voidedAt).toBeUndefined();
  });
});

describe("refreshLinkedEnvelopeFromLatestInbound", () => {
  beforeEach(() => {
    prismaMocks.findFirstInbound.mockReset();
    prismaMocks.transaction.mockReset();
  });

  it("returns false when no stored payloads", async () => {
    prismaMocks.findFirstInbound.mockResolvedValueOnce(null);
    await expect(refreshLinkedEnvelopeFromLatestInbound(ENV_ID)).resolves.toBe(false);
    expect(prismaMocks.transaction).not.toHaveBeenCalled();
  });

  it("runs mirror transaction using latest trimmed payload envelope id match", async () => {
    const tx = makeTx();
    tx.projectDocuSignEnvelope.findUnique.mockResolvedValue({
      id: "lnk",
      projectId: "p9",
      status: "sent",
      completedAt: null,
      voidedAt: null,
    });

    prismaMocks.transaction.mockImplementation(
      async (fn: (t: typeof tx) => Promise<boolean>) => fn(tx as never),
    );

    prismaMocks.findFirstInbound.mockResolvedValueOnce({
      payload: {
        event: "envelope-completed",
        data: { envelopeId: ENV_ID },
      },
    });

    await expect(refreshLinkedEnvelopeFromLatestInbound(ENV_ID)).resolves.toBe(true);
    expect(tx.projectDocuSignEnvelope.update).toHaveBeenCalled();
  });

  it("returns false when latest payload is an array JSON value", async () => {
    prismaMocks.findFirstInbound.mockResolvedValueOnce({
      payload: [],
    });

    await expect(refreshLinkedEnvelopeFromLatestInbound(ENV_ID)).resolves.toBe(false);
    expect(prismaMocks.transaction).not.toHaveBeenCalled();
  });

  it("returns false when extracted envelope disagrees with requested id", async () => {
    prismaMocks.findFirstInbound.mockResolvedValueOnce({
      payload: {
        data: {
          envelopeId: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
          envelopeSummary: { status: "sent" },
        },
      },
    });

    await expect(refreshLinkedEnvelopeFromLatestInbound(ENV_ID)).resolves.toBe(false);
    expect(prismaMocks.transaction).not.toHaveBeenCalled();
  });

  it("returns false when payload lacks event context to drive status mirror", async () => {
    prismaMocks.findFirstInbound.mockResolvedValueOnce({
      payload: {
        data: {
          envelopeId: ENV_ID,
        },
      },
    });

    await expect(refreshLinkedEnvelopeFromLatestInbound(ENV_ID)).resolves.toBe(false);
    expect(prismaMocks.transaction).not.toHaveBeenCalled();
  });
});

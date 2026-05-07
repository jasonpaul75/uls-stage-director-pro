import { beforeEach, describe, expect, it, vi } from "vitest";

type SesInputShape = {
  Source?: string;
  Destination?: { ToAddresses?: string[] };
  Message?: {
    Subject?: { Data?: string };
    Body?: { Text?: { Data?: string } };
  };
};

const sesHarness = vi.hoisted(() => {
  const sendCommandInput = vi.fn().mockResolvedValue(undefined);

  class SendEmailCommandMock {
    readonly input: SesInputShape;
    constructor(input: SesInputShape) {
      this.input = input;
    }
  }

  const SESClientCtor = vi.fn(() => ({
    send: async (command: InstanceType<typeof SendEmailCommandMock>) => {
      await sendCommandInput(command.input);
    },
  }));

  return { sendCommandInput, SESClientCtor, SendEmailCommandMock };
});

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: sesHarness.SESClientCtor,
  SendEmailCommand: sesHarness.SendEmailCommandMock,
}));

describe("sendDirectorInviteEmail", () => {
  const SES_FROM_ORIG = process.env.SES_FROM_EMAIL;

  beforeEach(async () => {
    sesHarness.sendCommandInput.mockReset();
    sesHarness.sendCommandInput.mockResolvedValue(undefined);
    sesHarness.SESClientCtor.mockClear();
    process.env.SES_FROM_EMAIL = SES_FROM_ORIG;
    delete process.env.AWS_REGION;
  });

  it("returns false and does not touch SES when SES_FROM_EMAIL unset", async () => {
    delete process.env.SES_FROM_EMAIL;
    const { sendDirectorInviteEmail } = await import("./send-director-invite");

    const ok = await sendDirectorInviteEmail({
      toEmail: "dir@uls.com",
      projectName: "Show A",
      inviteUrl: "https://app/invite",
    });

    expect(ok).toBe(false);
    expect(sesHarness.sendCommandInput).not.toHaveBeenCalled();
  });

  it("returns true after SES succeeds and includes invitation context", async () => {
    process.env.SES_FROM_EMAIL = " noreply@uls.com ";
    delete process.env.AWS_REGION;

    const { sendDirectorInviteEmail } = await import("./send-director-invite");
    const ok = await sendDirectorInviteEmail({
      toEmail: "dir@uls.com",
      projectName: "Show A",
      inviteUrl: "https://uls.example/invite/abc",
    });

    expect(ok).toBe(true);
    expect(sesHarness.sendCommandInput).toHaveBeenCalledTimes(1);
    const inp = sesHarness.sendCommandInput.mock.calls[0]?.[0] as SesInputShape;
    expect(inp.Source).toBe("noreply@uls.com");
    expect(inp.Destination?.ToAddresses).toEqual(["dir@uls.com"]);
    expect(inp.Message?.Subject?.Data).toContain("Show A");
    expect(inp.Message?.Body?.Text?.Data).toContain("https://uls.example/invite/abc");

    expect(sesHarness.SESClientCtor).toHaveBeenCalledWith({ region: "us-east-2" });
  });

  it("passes AWS_REGION through to SESClient when set", async () => {
    process.env.SES_FROM_EMAIL = "noreply@uls.com";
    process.env.AWS_REGION = "ap-south-1";

    const { sendDirectorInviteEmail } = await import("./send-director-invite");
    await sendDirectorInviteEmail({
      toEmail: "dir@uls.com",
      projectName: "Show",
      inviteUrl: "https://app/invite",
    });

    expect(sesHarness.SESClientCtor).toHaveBeenCalledWith({ region: "ap-south-1" });
  });

  it("returns false when SES send rejects", async () => {
    process.env.SES_FROM_EMAIL = "noreply@uls.com";
    sesHarness.sendCommandInput.mockReset();
    sesHarness.sendCommandInput.mockRejectedValueOnce(new Error("throttle"));

    const { sendDirectorInviteEmail } = await import("./send-director-invite");
    const ok = await sendDirectorInviteEmail({
      toEmail: "d@uls.com",
      projectName: "X",
      inviteUrl: "u",
    });
    expect(ok).toBe(false);
    expect(sesHarness.sendCommandInput).toHaveBeenCalled();
  });
});

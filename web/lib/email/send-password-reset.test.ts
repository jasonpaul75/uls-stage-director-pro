import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("sendPasswordResetEmail", () => {
  const SES_FROM_ORIG = process.env.SES_FROM_EMAIL;
  const AWS_REGION_ORIG = process.env.AWS_REGION;

  afterEach(() => {
    if (AWS_REGION_ORIG === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = AWS_REGION_ORIG;
  });

  beforeEach(async () => {
    sesHarness.sendCommandInput.mockReset();
    sesHarness.sendCommandInput.mockResolvedValue(undefined);
    sesHarness.SESClientCtor.mockClear();
    process.env.SES_FROM_EMAIL = SES_FROM_ORIG;
    delete process.env.AWS_REGION;
  });

  it("short-circuit false when SES_FROM_EMAIL absent", async () => {
    delete process.env.SES_FROM_EMAIL;

    const { sendPasswordResetEmail } = await import("./send-password-reset");
    await expect(sendPasswordResetEmail({ toEmail: "u@test.com", resetUrl: "https://reset" })).resolves.toBe(false);
    expect(sesHarness.sendCommandInput).not.toHaveBeenCalled();
  });

  it("sends localized subject body with reset URL", async () => {
    process.env.SES_FROM_EMAIL = "no-reply@test.com";

    const { sendPasswordResetEmail } = await import("./send-password-reset");
    await expect(
      sendPasswordResetEmail({ toEmail: "u@test.com", resetUrl: "https://uls.app/reset/xyz" }),
    ).resolves.toBe(true);

    const inp = sesHarness.sendCommandInput.mock.calls[0]?.[0] as SesInputShape;
    expect(inp.Destination?.ToAddresses?.[0]).toBe("u@test.com");
    expect(inp.Message?.Subject?.Data).toContain("Reset");
    expect(inp.Message?.Body?.Text?.Data).toContain("https://uls.app/reset/xyz");
    expect(sesHarness.SESClientCtor).toHaveBeenCalledWith({ region: "us-east-2" });
  });

  it("passes AWS_REGION through to SESClient", async () => {
    process.env.SES_FROM_EMAIL = "no-reply@test.com";
    process.env.AWS_REGION = "eu-west-1";

    const { sendPasswordResetEmail } = await import("./send-password-reset");
    await sendPasswordResetEmail({ toEmail: "u@test.com", resetUrl: "https://r" });

    expect(sesHarness.SESClientCtor).toHaveBeenCalledWith({ region: "eu-west-1" });
  });

  it("returns false when SES send rejects", async () => {
    process.env.SES_FROM_EMAIL = "no-reply@test.com";
    sesHarness.sendCommandInput.mockRejectedValueOnce(new Error("throttle-reset"));

    const { sendPasswordResetEmail } = await import("./send-password-reset");
    await expect(sendPasswordResetEmail({ toEmail: "u@test.com", resetUrl: "https://reset" })).resolves.toBe(false);
    expect(sesHarness.sendCommandInput).toHaveBeenCalled();
  });
});

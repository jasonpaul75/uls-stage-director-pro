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

describe("notifyIntakeSubmitted", () => {
  const SES_ORIG = process.env.SES_FROM_EMAIL;
  const NOTIFY_ORIG = process.env.INTAKE_NOTIFY_EMAIL;
  const BASE_ORIG = process.env.APP_BASE_URL;

  beforeEach(async () => {
    sesHarness.sendCommandInput.mockReset();
    sesHarness.sendCommandInput.mockResolvedValue(undefined);
    sesHarness.SESClientCtor.mockClear();
    process.env.SES_FROM_EMAIL = SES_ORIG;
    process.env.INTAKE_NOTIFY_EMAIL = NOTIFY_ORIG;
    process.env.APP_BASE_URL = BASE_ORIG;
    delete process.env.AWS_REGION;
  });

  const basePayload = () =>
    ({
      projectId: "proj_x",
      projectName: "Gala Night",
      slug: "gala-night",
      directorEmails: ["a@test.com"],
      venue: "Main Hall",
      cityState: "NYC",
      contestantApprox: 12,
      additionalNotes: "  Notes line  ",
      submittedAt: new Date("2026-04-10T03:05:06.007Z"),
    });

  it("noop when SES_FROM_EMAIL unset", async () => {
    delete process.env.SES_FROM_EMAIL;
    process.env.INTAKE_NOTIFY_EMAIL = "prod@uls.com";

    const { notifyIntakeSubmitted } = await import("./send-intake-notification");
    await notifyIntakeSubmitted(basePayload());

    expect(sesHarness.sendCommandInput).not.toHaveBeenCalled();
  });

  it("noop when INTAKE_NOTIFY_EMAIL unset", async () => {
    process.env.SES_FROM_EMAIL = "from@uls.com";
    delete process.env.INTAKE_NOTIFY_EMAIL;

    const { notifyIntakeSubmitted } = await import("./send-intake-notification");
    await notifyIntakeSubmitted(basePayload());

    expect(sesHarness.sendCommandInput).not.toHaveBeenCalled();
  });

  it("passes AWS_REGION through to SESClient when set", async () => {
    process.env.SES_FROM_EMAIL = "from@uls.com";
    process.env.INTAKE_NOTIFY_EMAIL = "ops@uls.com";
    process.env.AWS_REGION = "eu-west-1";

    const { notifyIntakeSubmitted } = await import("./send-intake-notification");
    await notifyIntakeSubmitted(basePayload());

    expect(sesHarness.sendCommandInput).toHaveBeenCalled();
    expect(sesHarness.SESClientCtor).toHaveBeenCalledWith({ region: "eu-west-1" });
  });

  it("noop when NOTIFY recipients parse empty", async () => {
    process.env.SES_FROM_EMAIL = "from@uls.com";
    process.env.INTAKE_NOTIFY_EMAIL = "  , ,";

    const { notifyIntakeSubmitted } = await import("./send-intake-notification");
    await notifyIntakeSubmitted(basePayload());

    expect(sesHarness.sendCommandInput).not.toHaveBeenCalled();
  });

  it("splits comma NOTIFY_TO, strips APP_BASE_URL trailing slash", async () => {
    process.env.SES_FROM_EMAIL = "from@uls.com";
    process.env.INTAKE_NOTIFY_EMAIL = " prod1@test.com , , prod2@test.com ";
    process.env.APP_BASE_URL = "https://uls-stage-director-pro.app///";

    const { notifyIntakeSubmitted } = await import("./send-intake-notification");

    await notifyIntakeSubmitted({
      ...basePayload(),
      directorEmails: [],
      additionalNotes: null,
      contestantApprox: null,
      venue: null,
      cityState: undefined,
    });

    expect(sesHarness.sendCommandInput).toHaveBeenCalledTimes(1);
    const inp = sesHarness.sendCommandInput.mock.calls[0]?.[0] as SesInputShape;
    expect(inp.Destination?.ToAddresses).toEqual(["prod1@test.com", "prod2@test.com"]);

    const text = inp.Message?.Body?.Text?.Data ?? "";
    /** `replace(/\/$/, '')` trims one slash; extra slashes survive before `/producer`. */
    expect(text).toMatch(/https:\/\/uls-stage-director-pro\.app\/+producer\/inbox\/proj_x/);
    expect(text).toContain("Director contact(s): (none)");
    expect(text).toContain("Venue / area: —");
    expect(text).toContain('Director notes / extra:\n—');
    expect(inp.Message?.Subject?.Data).toContain("New intake:");
  });

  it("suppresses SES throw (fire-and-forget contract)", async () => {
    process.env.SES_FROM_EMAIL = "from@uls.com";
    process.env.INTAKE_NOTIFY_EMAIL = "to@uls.com";
    sesHarness.sendCommandInput.mockReset();
    sesHarness.sendCommandInput.mockRejectedValueOnce(new Error("SES down"));

    const { notifyIntakeSubmitted } = await import("./send-intake-notification");
    await expect(notifyIntakeSubmitted(basePayload())).resolves.toBeUndefined();
  });
});

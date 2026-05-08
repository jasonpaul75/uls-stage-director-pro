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

describe("notifyDirectorShareUploaded", () => {
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

  const basePayload = () => ({
    projectId: "proj_x",
    projectName: "Gala Night",
    fileName: "walk-on.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 2_048_000,
    note: "  Walk  ",
    uploaderEmail: "dir@test.com",
  });

  it("noop when SES_FROM_EMAIL unset", async () => {
    delete process.env.SES_FROM_EMAIL;
    process.env.INTAKE_NOTIFY_EMAIL = "prod@uls.com";

    const { notifyDirectorShareUploaded } = await import("./send-director-share-notification");
    await notifyDirectorShareUploaded({ ...basePayload(), note: "Walk" });

    expect(sesHarness.sendCommandInput).not.toHaveBeenCalled();
  });

  it("noop when INTAKE_NOTIFY_EMAIL unset", async () => {
    process.env.SES_FROM_EMAIL = "from@uls.com";
    delete process.env.INTAKE_NOTIFY_EMAIL;

    const { notifyDirectorShareUploaded } = await import("./send-director-share-notification");
    await notifyDirectorShareUploaded({ ...basePayload(), note: null });

    expect(sesHarness.sendCommandInput).not.toHaveBeenCalled();
  });

  it("sends to comma-separated notify list with inbox anchor link", async () => {
    process.env.SES_FROM_EMAIL = "from@uls.com";
    process.env.INTAKE_NOTIFY_EMAIL = "a@uls.com, b@uls.com ";
    process.env.APP_BASE_URL = "https://app.example";

    const { notifyDirectorShareUploaded } = await import("./send-director-share-notification");
    await notifyDirectorShareUploaded({ ...basePayload(), note: null });

    expect(sesHarness.sendCommandInput).toHaveBeenCalledTimes(1);
    const input = sesHarness.sendCommandInput.mock.calls[0]![0] as SesInputShape;
    expect(input.Source).toBe("from@uls.com");
    expect(input.Destination?.ToAddresses).toEqual(["a@uls.com", "b@uls.com"]);
    expect(input.Message?.Subject?.Data).toContain("Gala Night");
    expect(input.Message?.Subject?.Data).toMatch(/Director production file/i);
    const body = input.Message?.Body?.Text?.Data ?? "";
    expect(body).toContain("walk-on.mp3");
    expect(body).toContain("https://app.example/producer/inbox/proj_x#director-shares-production");
    expect(body).toContain("https://app.example/producer/inbox/proj_x/event#director-shares-production");
    expect(body).toContain("Director note: —");
  });

  it("suppresses SES throw (fire-and-forget contract)", async () => {
    process.env.SES_FROM_EMAIL = "from@uls.com";
    process.env.INTAKE_NOTIFY_EMAIL = "ops@uls.com";
    sesHarness.sendCommandInput.mockRejectedValueOnce(new Error("SES down"));

    const { notifyDirectorShareUploaded } = await import("./send-director-share-notification");
    await expect(notifyDirectorShareUploaded({ ...basePayload(), note: "n" })).resolves.toBeUndefined();
  });
});

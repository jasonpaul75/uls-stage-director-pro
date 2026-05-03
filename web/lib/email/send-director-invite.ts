import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export type DirectorInviteEmailPayload = {
  toEmail: string;
  projectName: string;
  inviteUrl: string;
};

/** Invites director to open link and activate / join production. Same SES prerequisites as intake mail. */
export async function sendDirectorInviteEmail(payload: DirectorInviteEmailPayload): Promise<boolean> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  const region = process.env.AWS_REGION ?? "us-east-2";

  if (!from) {
    console.info("[email] sendDirectorInviteEmail skipped — SES_FROM_EMAIL unset.");
    return false;
  }

  const subject = `[ULS Stage Director PRO] You’re invited — ${payload.projectName}`;
  const text = `
You’ve been invited to join a production inside ULS Stage Director PRO.

Production: ${payload.projectName}

Open this secure link (expires in one week):

${payload.inviteUrl}

If you did not expect this message, ignore it.
`.trim();

  try {
    const client = new SESClient({ region });
    await client.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [payload.toEmail] },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Text: { Data: text, Charset: "UTF-8" } },
        },
      }),
    );
    return true;
  } catch (err) {
    console.error("[email] SES send failed (director invite):", err);
    return false;
  }
}

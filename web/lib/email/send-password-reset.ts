import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export type PasswordResetEmailPayload = {
  toEmail: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<boolean> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  const region = process.env.AWS_REGION ?? "us-east-2";

  if (!from) {
    console.info("[email] sendPasswordResetEmail skipped — SES_FROM_EMAIL unset.");
    return false;
  }

  const subject = "[ULS Stage Director PRO] Reset your password";
  const text = `
You requested a password reset.

Open this secure link — it expires in one hour:

${payload.resetUrl}

If you did not ask for this, you can ignore this email.
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
    console.error("[email] SES send failed (password reset):", err);
    return false;
  }
}

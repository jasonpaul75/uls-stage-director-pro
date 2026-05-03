import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

type IntakePayload = {
  projectId: string;
  projectName: string;
  slug: string;
  directorEmails: string[];
  venue?: string | null;
  cityState?: string | null;
  contestantApprox?: number | null;
  additionalNotes?: string | null;
  submittedAt: Date;
};

/** Fire-and-forget email to ULS when a director submits intake. Skips gracefully if SES env is incomplete. */
export async function notifyIntakeSubmitted(payload: IntakePayload): Promise<void> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  const notifyRaw = process.env.INTAKE_NOTIFY_EMAIL?.trim();
  const region = process.env.AWS_REGION ?? "us-east-2";
  const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  if (!from || !notifyRaw) {
    console.info(
      "[email] notifyIntakeSubmitted skipped — set SES_FROM_EMAIL and INTAKE_NOTIFY_EMAIL (comma-separated) to enable.",
    );
    return;
  }

  const toAddresses = notifyRaw.split(",").map((a) => a.trim()).filter(Boolean);
  if (toAddresses.length === 0) return;

  const directors = payload.directorEmails.length ? payload.directorEmails.join(", ") : "(none)";
  const where = [payload.venue, payload.cityState].filter(Boolean).join(" · ") || "—";

  const subject = `[ULS Stage Director PRO] New intake: ${payload.projectName}`;
  const text = `
A director submitted a new production intake.

Production: ${payload.projectName}
Slug: ${payload.slug}
Submitted (UTC): ${payload.submittedAt.toISOString()}

Director contact(s): ${directors}
Venue / area: ${where}
Contestants (approx): ${payload.contestantApprox ?? "—"}

Director notes / extra:
${payload.additionalNotes?.trim() ? payload.additionalNotes.trim() : "—"}

Open in app: ${baseUrl}/producer/inbox/${payload.projectId}
`.trim();

  try {
    const client = new SESClient({ region });
    await client.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: toAddresses },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Text: { Data: text, Charset: "UTF-8" } },
        },
      }),
    );
  } catch (err) {
    console.error("[email] SES send failed (intake notify):", err);
  }
}

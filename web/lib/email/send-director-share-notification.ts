import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

type DirectorSharePayload = {
  projectId: string;
  projectName: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  note: string | null;
  uploaderEmail: string;
};

function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Fire-and-forget email to ULS when a director uploads production reference media. Reuses intake notify env. */
export async function notifyDirectorShareUploaded(payload: DirectorSharePayload): Promise<void> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  const notifyRaw = process.env.INTAKE_NOTIFY_EMAIL?.trim();
  const region = process.env.AWS_REGION ?? "us-east-2";
  const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  if (!from || !notifyRaw) {
    console.info(
      "[email] notifyDirectorShareUploaded skipped — set SES_FROM_EMAIL and INTAKE_NOTIFY_EMAIL (comma-separated) to enable.",
    );
    return;
  }

  const toAddresses = notifyRaw
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  if (toAddresses.length === 0) return;

  const subject = `[ULS Stage Director PRO] Director production file — ${payload.projectName}`;
  const noteBlock = payload.note?.trim()
    ? `Director note:\n${payload.note.trim()}`
    : "Director note: —";

  const text = `
A director uploaded a reference audio/video file for production (Director production files in the producer desk).

Production: ${payload.projectName}
File: ${payload.fileName}
Type: ${payload.contentType}
Size: ${formatBytes(payload.sizeBytes)}
Uploaded by: ${payload.uploaderEmail}

${noteBlock}

Open in producer — Director production files section:
Intake detail: ${baseUrl}/producer/inbox/${payload.projectId}#director-shares-production
Event workspace: ${baseUrl}/producer/inbox/${payload.projectId}/event#director-shares-production
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
    console.error("[email] SES send failed (director production file notify):", err);
  }
}

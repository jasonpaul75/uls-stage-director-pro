"use client";

import { useState } from "react";

import { ATTACHMENTS_PRESIGNED_PUT_HEADERS } from "@/lib/s3-project-attachments";
import {
  SHOW_MEDIA_MAX_BYTES,
  showMediaFriendlyTypeSummary,
  showMediaLaneFileAcceptAttr,
} from "@/lib/show-media-upload-policy";
import { ShowMediaLane } from "@prisma/client";

type Lane = "MUSIC" | "VIDEO";

type Finalize = (formData: FormData) => Promise<void>;

function toShowMediaLane(lane: Lane): ShowMediaLane {
  return lane === "MUSIC" ? ShowMediaLane.MUSIC : ShowMediaLane.VIDEO;
}

function formatLaneMaxHint(lane: Lane): string {
  const bytes = SHOW_MEDIA_MAX_BYTES[toShowMediaLane(lane)];
  if (lane === "MUSIC") return `~${Math.round(bytes / (1024 * 1024))} MB`;
  return `~${bytes / (1024 * 1024 * 1024)} GB`;
}

/**
 * Direct browser → S3 upload using presigned PUT, then server finalize (DB row).
 * Presigned URLs sign SSE-S3 plus `host` (Content-Type is intentionally unsigned); send headers from {@link ATTACHMENTS_PRESIGNED_PUT_HEADERS}.
 * Omit `Content-Type` on PUT (`Blob` body with empty MIME). CORS must allow the encryption header and your app origin (.env.example).
 */
export function ShowMediaPresignedUploadForm(props: {
  presignPath: string;
  /** Intake only — omitted for media library. */
  projectId?: string;
  lane: Lane;
  disabled: boolean;
  finalizeAction: Finalize;
  uploadLabel?: string;
}) {
  const { presignPath, projectId, lane, disabled, finalizeAction, uploadLabel = "Upload" } = props;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const input = form.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file || file.size <= 0) {
      setError("Choose a non-empty file.");
      return;
    }

    setPending(true);
    try {
      const ct = (file.type || "application/octet-stream").trim().toLowerCase();
      const body: Record<string, unknown> = {
        lane,
        fileName: file.name,
        contentType: ct,
        sizeBytes: file.size,
      };
      if (projectId) body.projectId = projectId;

      const pres = await fetch(presignPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const presJson = (await pres.json().catch(() => ({}))) as { uploadUrl?: string; storageKey?: string; error?: string };

      if (!pres.ok) {
        const msg =
          presJson.error === "Too large"
            ? `File exceeds the ${lane === "MUSIC" ? "music" : "video"} limit for this lane (${formatLaneMaxHint(lane)}).`
            : presJson.error === "Bad type"
              ? `That file type isn’t allowed for this lane. ${showMediaFriendlyTypeSummary(toShowMediaLane(lane))}`
              : presJson.error === "Bad project"
                ? "That intake isn’t available."
                : presJson.error === "Event workspace locked"
                  ? "Event workspace stays locked until a contract is completed in DocuSign and at least one Stripe invoice shows paid — finish those on Intake, then return here."
                  : pres.status === 403
                    ? "Sign in as production staff and try again."
                    : pres.status === 503
                      ? "Storage isn’t configured on the server."
                      : "Could not start upload.";
        setError(msg);
        return;
      }

      const { uploadUrl, storageKey } = presJson;
      if (!uploadUrl || !storageKey) {
        setError("Invalid presign response.");
        return;
      }

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { ...ATTACHMENTS_PRESIGNED_PUT_HEADERS },
        body: new Blob([file], { type: "" }),
      });

      if (!put.ok) {
        setError(
          "Upload to storage failed. Presigned PUTs omit Content-Type — this client uses SSE-S3 headers + untyped blob. If this persists, inspect the PUT response body (IAM / bucket policy denies missing encryption) and CORS must allow PutObject headers (.env.example).",
        );
        return;
      }

      const fd = new FormData();
      fd.set("lane", lane);
      fd.set("storageKey", storageKey);
      fd.set("fileName", file.name);
      if (projectId) fd.set("projectId", projectId);

      await finalizeAction(fd);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "digest" in err &&
        String((err as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT")
      ) {
        throw err;
      }
      const net =
        err instanceof TypeError ||
        (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message));
      setError(
        net
          ? "Upload failed — if the DevTools console shows a CORS error on the S3 URL, edit the attachments bucket’s CORS to allow PUT from this page’s origin (see .env.example for a JSON template)."
          : "Something went wrong during upload.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
        <input type="hidden" name="lane" value={lane} />
        <label className="flex min-h-11 min-w-[12rem] flex-1 flex-col gap-1 rounded-lg px-1 py-1 text-sm outline-none transition-shadow focus-within:ring-2 focus-within:ring-violet-500/45 focus-within:ring-offset-2 focus-within:ring-offset-zinc-950">
          <span className="text-zinc-400">Add file</span>
          <input
            name="file"
            type="file"
            required
            accept={showMediaLaneFileAcceptAttr(toShowMediaLane(lane))}
            disabled={disabled || pending}
            aria-label={`Choose ${lane === "MUSIC" ? "music" : "video"} file to upload (${formatLaneMaxHint(lane)} max)`}
            className="text-xs text-zinc-300 file:mr-2 file:rounded-md file:border-0 file:bg-zinc-700 file:px-2 file:py-2 file:text-zinc-100 disabled:opacity-40"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || pending}
          className="min-h-11 w-fit rounded bg-zinc-200 px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Uploading…" : uploadLabel}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

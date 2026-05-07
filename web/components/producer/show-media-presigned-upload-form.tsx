"use client";

import { useState } from "react";

type Lane = "MUSIC" | "VIDEO";

type Finalize = (formData: FormData) => Promise<void>;

/**
 * Direct browser → S3 upload using presigned PUT, then server finalize (DB row).
 * Requires bucket CORS to allow PUT from your app origin (`http://localhost:3000`, production host).
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
            ? "File exceeds the size limit for this lane."
            : presJson.error === "Bad type"
              ? "That file type isn’t allowed for this lane."
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
        body: file,
        headers: {
          "Content-Type": ct,
        },
      });

      if (!put.ok) {
        setError(
          "Upload to storage failed. If the file is large, check S3 bucket CORS allows PUT from this site (see .env.example).",
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
      setError("Something went wrong during upload.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
        <input type="hidden" name="lane" value={lane} />
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-zinc-400">Add file</span>
          <input
            name="file"
            type="file"
            required
            disabled={disabled || pending}
            className="text-xs text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-zinc-100 disabled:opacity-40"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || pending}
          className="w-fit rounded bg-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
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

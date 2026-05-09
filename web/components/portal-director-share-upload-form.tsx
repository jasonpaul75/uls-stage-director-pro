"use client";

import { useState } from "react";

import { finalizeDirectorShareUpload } from "@/app/portal/director-share-actions";
import { directorShareFriendlyTypeSummary } from "@/lib/director-share-upload-policy";
import { parseAmazonS3ErrorXml } from "@/lib/s3-error-xml";

type Finalize = typeof finalizeDirectorShareUpload;

/**
 * Direct browser → S3 upload (presign) for director production shares, then finalize row.
 */
export function PortalDirectorShareUploadForm(props: {
  projectId: string;
  /** `intake` → `/portal/projects/...`; `show` → `/portal/shows/...` */
  portalReturn: "intake" | "show";
  disabled: boolean;
  finalizeAction?: Finalize;
}) {
  const { projectId, portalReturn, disabled, finalizeAction = finalizeDirectorShareUpload } = props;
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
      const pres = await fetch("/api/portal/director-shares/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fileName: file.name,
          contentType: ct,
          sizeBytes: file.size,
        }),
      });

      const presJson = (await pres.json().catch(() => ({}))) as { uploadUrl?: string; storageKey?: string; error?: string };

      if (!pres.ok) {
        const msg =
          presJson.error === "Too large"
            ? "That file is too large — director production file uploads are limited to 1 GB each (same ceiling as video cue files)."
            : presJson.error === "Bad type"
              ? `That file type isn’t allowed — ${directorShareFriendlyTypeSummary()}`
              : presJson.error === "Bad project"
                ? "This production isn’t open for uploads."
                : presJson.error === "Portal access ended"
                  ? "Your portal access for this show has ended."
                  : pres.status === 403
                    ? "Sign in as a director invited to this production."
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
        body: new Blob([file], { type: "" }),
      });

      if (!put.ok) {
        const raw = await put.text().catch(() => "");
        const { code, message } = parseAmazonS3ErrorXml(raw);
        const detail = [code, message].filter(Boolean).join(": ");
        setError(
          `Upload to storage failed${detail ? ` (${detail})` : ""}. Use untyped Blob, no Content-Type. SignatureDoesNotMatch → check Vercel AWS key pair; see README.`,
        );
        return;
      }

      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("portalReturn", portalReturn);
      fd.set("storageKey", storageKey);
      fd.set("fileName", file.name);
      const noteEl = form.querySelector("textarea[name=\"note\"]") as HTMLTextAreaElement | null;
      if (noteEl?.value?.trim()) fd.set("note", noteEl.value.trim());

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
    <div className="mt-3">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="portalReturn" value={portalReturn} />
        <label className="flex min-h-11 min-w-[12rem] flex-1 flex-col gap-1 rounded-lg px-1 py-1 text-sm outline-none transition-shadow focus-within:ring-2 focus-within:ring-violet-500/45 focus-within:ring-offset-2 focus-within:ring-offset-zinc-950">
          <span className="text-uls-muted">Audio / video for ULS</span>
          <input
            name="file"
            type="file"
            required
            disabled={disabled || pending}
            accept="audio/*,video/*"
            aria-label="Choose audio or video file to share with production (up to 1 GB)"
            className="text-xs text-uls-muted file:mr-2 file:rounded-lg file:border file:border-white/[0.12] file:bg-white/[0.06] file:px-2 file:py-2 file:text-uls-text disabled:opacity-40"
          />
        </label>
        <label className="flex flex-col gap-1 rounded-lg px-1 py-1 text-sm outline-none transition-shadow focus-within:ring-2 focus-within:ring-violet-500/45 focus-within:ring-offset-2 focus-within:ring-offset-zinc-950">
          <span className="text-uls-muted">Note for production (optional)</span>
          <textarea
            name="note"
            rows={2}
            maxLength={500}
            disabled={disabled || pending}
            placeholder="e.g. Walk-in track, 92 BPM"
            className="min-h-[4.25rem] rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-uls-text placeholder:text-uls-subtle disabled:opacity-40"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || pending}
          className="min-h-11 w-fit rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-xs font-semibold text-violet-50 hover:bg-violet-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Uploading…" : "Upload for production"}
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

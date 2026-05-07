import Link from "next/link";

import { deleteShowMediaLibraryItem } from "@/app/producer/media-library/actions";
import { MediaLibraryUploadSection } from "@/components/producer/media-library-upload-section";
import { prisma } from "@/lib/prisma";
import { SHOW_MEDIA_MAX_BYTES } from "@/lib/show-media-upload-policy";
import { attachmentsBucketConfigured } from "@/lib/s3-project-attachments";
import { ShowMediaLane } from "@prisma/client";

function formatMediaSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function laneLabel(lane: ShowMediaLane) {
  return lane === ShowMediaLane.MUSIC ? "Music" : "Video";
}

type Sp = Record<string, string | string[] | undefined>;

export default async function MediaLibraryPage(props: { searchParams?: Promise<Sp> }) {
  const sp = (await props.searchParams) ?? {};

  const s3Ok = attachmentsBucketConfigured();
  const rows = await prisma.showMediaLibraryItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      lane: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
      uploadedBy: { select: { email: true, name: true } },
    },
  });

  const maxMusicMb = SHOW_MEDIA_MAX_BYTES[ShowMediaLane.MUSIC] / (1024 * 1024);
  const maxVideoGb = SHOW_MEDIA_MAX_BYTES[ShowMediaLane.VIDEO] / (1024 * 1024 * 1024);

  return (
    <main id="producer-main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <p className="text-sm uppercase tracking-widest text-amber-500">Media library</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Cross-show cues</h1>
      <p className="mt-2 max-w-2xl text-xs text-zinc-500">
        Upload reusable tracks here, then attach them into any submitted intake playlist without re-uploading (S3 copy into{" "}
        <span className="font-mono text-zinc-500">project-show-media/</span>
        ).
      </p>
      <p className="mt-3 text-xs text-zinc-500">
        <Link href="/producer/inbox" className="text-violet-400 underline hover:text-violet-300">
          ← Intake inbox
        </Link>
      </p>

      {sp.lib_uploaded === "1" ? (
        <p className="mt-4 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Library item saved.
        </p>
      ) : null}
      {sp.lib_deleted === "1" ? (
        <p className="mt-4 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Removed from library and storage.
        </p>
      ) : null}
      {sp.lib_err === "storage_not_configured" ? (
        <p className="mt-4 text-sm text-red-400">Configure AWS S3 for the attachments bucket before uploading.</p>
      ) : null}
      {sp.lib_err === "bad_type" ? (
        <p className="mt-4 text-sm text-red-400">That file type isn&apos;t allowed for the selected lane.</p>
      ) : null}
      {sp.lib_err === "too_large" ? (
        <p className="mt-4 text-sm text-red-400">File exceeds lane size limits.</p>
      ) : null}
      {sp.lib_err === "not_found" ? (
        <p className="mt-4 text-sm text-red-400">That library row no longer exists.</p>
      ) : null}
      {sp.lib_err === "bad_request" || sp.lib_err === "server" ? (
        <p className="mt-4 text-sm text-red-400">
          {sp.lib_err === "server" ? "Server error — try again." : "That request couldn’t be processed."}
        </p>
      ) : null}

      {!s3Ok ? (
        <p className="mt-4 rounded border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100">
          S3 uploads disabled — configure <span className="font-mono">AWS_S3_ATTACHMENTS_BUCKET</span>.
        </p>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-200">Add to library</h2>
        <p className="mt-1 text-[11px] text-zinc-600">
          Music ceiling ~{Math.round(maxMusicMb)} MB · Video up to ~{maxVideoGb} GB per product cap. Browser uploads go directly to
          S3 (configure bucket CORS for your origin — see <span className="font-mono">.env.example</span>).
        </p>
        <MediaLibraryUploadSection disabled={!s3Ok} />
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-medium text-zinc-200">Library items</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-600">No cues in the shared library yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-300 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">{r.fileName}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {laneLabel(r.lane)} · {formatMediaSize(r.sizeBytes)} · {r.contentType}
                    {(r.uploadedBy.name ?? "").trim() || r.uploadedBy.email
                      ? ` · ${(r.uploadedBy.name ?? "").trim() || r.uploadedBy.email}`
                      : ""}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-600">{r.id}</p>
                </div>
                <form action={deleteShowMediaLibraryItem}>
                  <input type="hidden" name="itemId" value={r.id} />
                  <button
                    type="submit"
                    className="rounded border border-red-900/70 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

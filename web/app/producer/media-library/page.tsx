import Link from "next/link";

import { deleteShowMediaLibraryItem } from "@/app/producer/media-library/actions";
import { MediaLibraryUploadSection } from "@/components/producer/media-library-upload-section";
import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, buttonClassName } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { SHOW_MEDIA_ERR_COPY } from "@/lib/show-media-err-copy";
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

function streamUrl(libraryItemId: string): string {
  return `/api/producer/media-library/${libraryItemId}`;
}

function isBrowserInlineAudio(contentType: string): boolean {
  return contentType.trim().toLowerCase().startsWith("audio/");
}

function isBrowserInlineVideo(contentType: string): boolean {
  return contentType.trim().toLowerCase().startsWith("video/");
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
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Media library</p>
          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">Cross-show cues</h1>
          <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
            Upload reusable tracks here, then attach them into any submitted intake playlist without re-uploading (S3 copy into{" "}
            <span className="font-mono text-xs text-uls-subtle">project-show-media/</span>).
          </p>
        </header>
        <Link href="/producer/inbox" className={buttonClassName("ghost", "sm", "shrink-0")}>
          ← Intake inbox
        </Link>
      </div>

      {sp.lib_uploaded === "1" ? (
        <div
          role="status"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-50 backdrop-blur-sm"
        >
          Library item saved.
        </div>
      ) : null}
      {sp.lib_deleted === "1" ? (
        <div
          role="status"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-50 backdrop-blur-sm"
        >
          Removed from library and storage.
        </div>
      ) : null}
      {typeof sp.lib_err === "string" && SHOW_MEDIA_ERR_COPY[sp.lib_err] ? (
        <p role="alert" className="mt-6 text-sm text-red-400">
          {SHOW_MEDIA_ERR_COPY[sp.lib_err]}
        </p>
      ) : typeof sp.lib_err === "string" ? (
        <p role="alert" className="mt-6 text-sm text-red-400">
          Library upload action failed — try again.
        </p>
      ) : null}

      {!s3Ok ? (
        <div
          role="status"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-[11px] text-amber-50 backdrop-blur-sm"
        >
          S3 uploads disabled — configure <span className="font-mono">AWS_S3_ATTACHMENTS_BUCKET</span>.
        </div>
      ) : null}

      <ProducerGlassCard id="library-upload" className="mt-10">
        <h2 className="text-sm font-semibold text-uls-text">Add to library</h2>
        <p className="mt-1 text-[11px] text-uls-muted">
          Music ceiling ~{Math.round(maxMusicMb)} MB · Video up to ~{maxVideoGb} GB per product cap. Browser uploads go directly
          to S3 (configure bucket CORS for your origin — see <span className="font-mono">.env.example</span>).
        </p>
        <div className="mt-4">
          <MediaLibraryUploadSection disabled={!s3Ok} />
        </div>
      </ProducerGlassCard>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-uls-text">Library items</h2>
        {rows.length === 0 ? (
          <ProducerGlassCard as="div" padding="compact" className="mt-4 border-dashed border-white/[0.12] bg-white/[0.02]">
            <p className="text-sm text-uls-muted">No shared cues yet — build your rundown library once, import into each intake.</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[11px] text-uls-subtle">
              <li>
                Add files in <a href="#library-upload" className="text-violet-400 underline hover:text-violet-300">Add to library</a>{" "}
                above (music and video lanes use different ceilings).
              </li>
              <li>
                Open any intake&apos;s Show media section → import from library — no duplicate upload (S3 copy into the production).
              </li>
              <li>
                <Link href="/producer/inbox" className="text-violet-400 underline hover:text-violet-300">
                  Intake inbox
                </Link>{" "}
                lists every queued production.
              </li>
            </ul>
          </ProducerGlassCard>
        ) : (
          <ul className="mt-4 list-none space-y-3 pl-0">
            {rows.map((r) => (
              <li key={r.id} className="list-none">
                <ProducerGlassCard as="div" padding="compact" className="text-xs text-uls-muted">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-uls-text">{r.fileName}</p>
                      <p className="mt-0.5 text-[10px] text-uls-subtle">
                        {laneLabel(r.lane)} · {formatMediaSize(r.sizeBytes)} · {r.contentType}
                        {(r.uploadedBy.name ?? "").trim() || r.uploadedBy.email
                          ? ` · ${(r.uploadedBy.name ?? "").trim() || r.uploadedBy.email}`
                          : ""}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-uls-subtle">{r.id}</p>
                      {s3Ok ? (
                        <>
                          {isBrowserInlineAudio(r.contentType) ? (
                            <audio
                              controls
                              preload="none"
                              className="mt-3 h-10 w-full max-w-md rounded-md border border-white/[0.08] bg-black/40"
                              src={streamUrl(r.id)}
                            />
                          ) : null}
                          {isBrowserInlineVideo(r.contentType) ? (
                            <video
                              controls
                              preload="metadata"
                              playsInline
                              className="mt-3 max-h-52 w-full max-w-xl rounded-lg border border-white/[0.1] bg-black/50"
                              src={streamUrl(r.id)}
                            />
                          ) : null}
                          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                            <a
                              href={streamUrl(r.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-violet-400 underline decoration-violet-500/45 underline-offset-2 hover:text-violet-300"
                            >
                              Preview stream (new tab)
                            </a>
                            <span className="text-uls-subtle" aria-hidden>
                              ·
                            </span>
                            <a
                              href={`${streamUrl(r.id)}?download=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-400 underline decoration-zinc-600/45 underline-offset-2 hover:text-zinc-200"
                            >
                              Download
                            </a>
                          </p>
                        </>
                      ) : null}
                    </div>
                    <form action={deleteShowMediaLibraryItem}>
                      <input type="hidden" name="itemId" value={r.id} />
                      <button
                        type="submit"
                        className="min-h-9 rounded-lg border border-red-900/55 bg-red-950/35 px-3 py-1.5 text-[11px] text-red-200 transition hover:bg-red-950/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                        aria-label={`Delete ${r.fileName} from shared library`}
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </ProducerGlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

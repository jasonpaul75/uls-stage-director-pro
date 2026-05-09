import Link from "next/link";
import { ShowMediaLane } from "@prisma/client";

import {
  deleteShowMediaItem,
  duplicateShowMediaItem,
  finalizeShowMediaItemAfterS3Upload,
  importShowMediaFromLibrary,
  importShowMediaFromOtherProject,
  reorderShowMediaItem,
  saveShowMediaVisibility,
} from "@/app/producer/inbox/show-media-actions";
import { PortalMusicSequentialPlayer } from "@/components/portal-show-media-playback";
import { ShowMediaPresignedUploadForm } from "@/components/producer/show-media-presigned-upload-form";
import { ShowMediaWaveformStrip } from "@/components/show-media-waveform-strip";
import { Button } from "@/components/ui";
import { SHOW_MEDIA_WAVEFORM_DECODE_MAX_BYTES } from "@/lib/show-media-waveform-peaks";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { SHOW_MEDIA_MAX_BYTES, showMediaFriendlyTypeSummary } from "@/lib/show-media-upload-policy";
import { attachmentsBucketConfigured } from "@/lib/s3-project-attachments";
import { producerIntakeFieldClass, producerIntakeInsetFieldsetClass } from "@/lib/producer-intake-ui";

import { ProducerIntakeCollapsible } from "./producer-intake-collapsible";
import { ProducerIntakeSectionShell } from "./producer-intake-section-shell";

const showMediaRowFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

const showMediaRowDestructiveFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

function formatMediaSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function laneLabel(lane: ShowMediaLane) {
  return lane === ShowMediaLane.MUSIC ? "Music" : "Video";
}

export type ShowMediaCrossProjectPick = {
  id: string;
  name: string;
  showMediaItems: { id: string; fileName: string; lane: ShowMediaLane }[];
};

export type ShowMediaLibraryRow = {
  id: string;
  fileName: string;
  lane: ShowMediaLane;
  contentType: string;
};

export function ProducerIntakeShowMediaSection(props: {
  project: Pick<ProducerIntakeDetailProject, "id" | "showMediaDirectorVisible" | "showMediaItems">;
  libraryItems: ShowMediaLibraryRow[];
  crossProjectPicklist: ShowMediaCrossProjectPick[];
}) {
  const { project, libraryItems, crossProjectPicklist } = props;
  const s3Ok = attachmentsBucketConfigured();
  const crossPickCount = crossProjectPicklist.reduce((n, p) => n + p.showMediaItems.length, 0);
  const music = project.showMediaItems.filter((i) => i.lane === ShowMediaLane.MUSIC);
  const video = project.showMediaItems.filter((i) => i.lane === ShowMediaLane.VIDEO);
  const maxMusicMb = SHOW_MEDIA_MAX_BYTES[ShowMediaLane.MUSIC] / (1024 * 1024);
  const maxVideoGb = SHOW_MEDIA_MAX_BYTES[ShowMediaLane.VIDEO] / (1024 * 1024 * 1024);

  const importCollapsibleOpen = libraryItems.length > 0 || crossPickCount > 0;

  return (
    <ProducerIntakeSectionShell
      id="show-media"
      title="Show media"
      description={
        <p>
          Crew-facing playlists — upload audio and video cues in rundown order (browser uploads go directly to S3; bucket CORS is
          required per <span className="font-mono text-uls-subtle">.env.example</span>). Directors see playback in the portal show
          workspace when you publish below. Audio uses the device the OS routes to browser output; open each video in a separate
          window for a second monitor. In the portal, approximate waveform strips help identify music cues; very large files skip
          waveform decode (over ~{Math.round(SHOW_MEDIA_WAVEFORM_DECODE_MAX_BYTES / (1024 * 1024))} MB) so weak machines stay responsive. Objects live under{" "}
          <span className="font-mono text-uls-subtle">project-show-media/</span>.{" "}
          <Link href="/producer/media-library" className="text-violet-400 underline hover:text-violet-300">
            Shared library
          </Link>{" "}
          stores reusable cues — import performs a server-side copy into this intake.
        </p>
      }
    >
      {!s3Ok ? (
        <p className="rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100">
          S3 uploads disabled — configure <span className="font-mono">AWS_S3_ATTACHMENTS_BUCKET</span> (same bucket as confidential
          files).
        </p>
      ) : null}

      <form action={saveShowMediaVisibility}>
        <fieldset className={producerIntakeInsetFieldsetClass}>
          <legend className="sr-only">Director visibility</legend>
          <input type="hidden" name="projectId" value={project.id} />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="showMediaDirectorVisible"
              defaultChecked={project.showMediaDirectorVisible}
              value="on"
            />
            <span>Show playlists to directors (Show workspace playback)</span>
          </label>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            className="mt-2 border-violet-800/70 bg-violet-950/40 text-violet-100 hover:bg-violet-900/50"
          >
            Save visibility
          </Button>
        </fieldset>
      </form>

      {s3Ok ? (
        <ProducerIntakeCollapsible title="Import without re-upload (CORS / CopyObject)" defaultOpen={importCollapsibleOpen}>
          <div className="space-y-5">
            <p className="text-[11px] text-uls-muted">
              Imports append to the lane of the source cue (<span className="font-mono text-uls-subtle">s3:CopyObject</span>{" "}
              server-side). Requires correct bucket CORS and copy permissions on keys.
            </p>

            <form
              action={importShowMediaFromLibrary}
              className="flex flex-col gap-3 border-t border-uls-border/80 pt-4 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <input type="hidden" name="projectId" value={project.id} />
              <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
                <span className="text-uls-muted">Media library</span>
                <select
                  name="libraryItemId"
                  required
                  disabled={libraryItems.length === 0}
                  className={`${producerIntakeFieldClass} py-1.5 text-xs disabled:opacity-40`}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a library cue…
                  </option>
                  {libraryItems.map((li) => (
                    <option key={li.id} value={li.id}>
                      {laneLabel(li.lane)} — {li.fileName}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="primary" size="sm" disabled={libraryItems.length === 0}>
                Import library cue
              </Button>
            </form>

            <form
              action={importShowMediaFromOtherProject}
              className="flex flex-col gap-3 border-t border-uls-border/80 pt-4 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <input type="hidden" name="projectId" value={project.id} />
              <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
                <span className="text-uls-muted">Another submitted intake</span>
                <select
                  name="sourceItemRef"
                  required
                  disabled={crossPickCount === 0}
                  className={`${producerIntakeFieldClass} py-1.5 text-xs disabled:opacity-40`}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a cue from another show…
                  </option>
                  {crossProjectPicklist.map((p) => (
                    <optgroup key={p.id} label={p.name}>
                      {p.showMediaItems.map((m) => (
                        <option key={m.id} value={`${p.id}|${m.id}`}>
                          {laneLabel(m.lane)} — {m.fileName}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="primary" size="sm" disabled={crossPickCount === 0}>
                Import from other show
              </Button>
            </form>

            {libraryItems.length === 0 ? (
              <p className="text-[11px] text-uls-muted">
                No rows in{" "}
                <Link href="/producer/media-library" className="text-violet-400 underline hover:text-violet-300">
                  media library
                </Link>{" "}
                yet.
              </p>
            ) : null}
            {crossPickCount === 0 ? (
              <p className="text-[11px] text-uls-muted">No other submitted intakes have show media yet.</p>
            ) : null}
          </div>
        </ProducerIntakeCollapsible>
      ) : null}

      {([ShowMediaLane.MUSIC, ShowMediaLane.VIDEO] as const).map((lane) => {
        const list = lane === ShowMediaLane.MUSIC ? music : video;
        const maxNote =
          lane === ShowMediaLane.MUSIC ? `${Math.round(maxMusicMb)} MB` : `${maxVideoGb} GB (product cap)`;
        return (
          <div key={lane}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-uls-subtle">{laneLabel(lane)} playlist</h3>
            <p className="mt-1 text-[11px] text-uls-muted">Max upload size: {maxNote}</p>
            <p className="mt-0.5 text-[10px] text-uls-subtle">{showMediaFriendlyTypeSummary(lane)}</p>
            <ShowMediaPresignedUploadForm
              presignPath="/api/producer/show-media/presign"
              projectId={project.id}
              lane={lane === ShowMediaLane.MUSIC ? "MUSIC" : "VIDEO"}
              disabled={!s3Ok}
              finalizeAction={finalizeShowMediaItemAfterS3Upload}
            />

            {list.length === 0 ? (
              <p className="mt-3 text-xs text-uls-muted">No {laneLabel(lane).toLowerCase()} tracks yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {list.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 rounded-uls-card border border-uls-border bg-uls-surface/50 px-3 py-2 text-xs text-uls-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-uls-text">{item.fileName}</p>
                      <p className="mt-0.5 text-[10px] text-uls-subtle">
                        {formatMediaSize(item.sizeBytes)} · {item.contentType}
                        {(item.uploadedBy.name ?? "").trim() || item.uploadedBy.email
                          ? ` · ${(item.uploadedBy.name ?? "").trim() || item.uploadedBy.email}`
                          : ""}
                      </p>
                      {item.contentType.trim().toLowerCase().startsWith("audio/") ? (
                        <ShowMediaWaveformStrip
                          variant="producer"
                          mediaItemId={item.id}
                          contentType={item.contentType}
                          sizeBytes={item.sizeBytes}
                        />
                      ) : null}
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <a
                          href={`/api/show-media/${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex min-h-9 items-center text-violet-400 underline decoration-violet-500/50 underline-offset-2 hover:text-violet-300 ${showMediaRowFocus} rounded-md px-1`}
                          aria-label={`Open stream preview for ${item.fileName} in a new tab`}
                        >
                          Preview stream
                        </a>
                        <span className="text-uls-subtle" aria-hidden>
                          ·
                        </span>
                        <a
                          href={`/api/show-media/${item.id}?download=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex min-h-9 items-center text-zinc-400 underline decoration-zinc-600/50 underline-offset-2 hover:text-zinc-200 ${showMediaRowFocus} rounded-md px-1`}
                          aria-label={`Download ${item.fileName}`}
                        >
                          Download
                        </a>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={reorderShowMediaItem} className="inline">
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          type="submit"
                          className={`inline-flex min-h-9 min-w-9 touch-manipulation items-center justify-center rounded-md border border-uls-border-strong text-xs text-uls-muted hover:bg-uls-surface-inset ${showMediaRowFocus}`}
                          title="Move up in rundown"
                          aria-label={`Move ${laneLabel(lane).toLowerCase()} cue up in rundown: ${item.fileName}`}
                        >
                          ↑
                        </button>
                      </form>
                      <form action={reorderShowMediaItem} className="inline">
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          className={`inline-flex min-h-9 min-w-9 touch-manipulation items-center justify-center rounded-md border border-uls-border-strong text-xs text-uls-muted hover:bg-uls-surface-inset ${showMediaRowFocus}`}
                          title="Move down in rundown"
                          aria-label={`Move ${laneLabel(lane).toLowerCase()} cue down in rundown: ${item.fileName}`}
                        >
                          ↓
                        </button>
                      </form>
                      <form action={duplicateShowMediaItem} className="inline">
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          disabled={!s3Ok}
                          className={`inline-flex min-h-9 touch-manipulation items-center justify-center rounded-md border border-uls-border px-3 text-[11px] text-uls-muted hover:bg-uls-surface-inset disabled:cursor-not-allowed disabled:opacity-40 ${showMediaRowFocus}`}
                          title="Duplicate cue (S3 copy to end of lane)"
                          aria-label={`Duplicate ${item.fileName} in this ${laneLabel(lane).toLowerCase()} playlist`}
                        >
                          Duplicate
                        </button>
                      </form>
                      <form action={deleteShowMediaItem} className="inline">
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className={`inline-flex min-h-9 touch-manipulation items-center justify-center rounded-md border border-red-900/70 px-3 text-[11px] text-red-300 hover:bg-red-950/40 ${showMediaRowDestructiveFocus}`}
                          aria-label={`Remove ${item.fileName} from this ${laneLabel(lane).toLowerCase()} playlist`}
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {lane === ShowMediaLane.MUSIC && list.length > 0 ? (
              <div className="mt-4 rounded-uls-card border border-uls-border bg-uls-surface/45 px-3 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-uls-subtle">Rundown preview (director UX)</p>
                <PortalMusicSequentialPlayer
                  tracks={music.map((t) => ({
                    id: t.id,
                    fileName: t.fileName,
                    contentType: t.contentType,
                    sizeBytes: t.sizeBytes,
                  }))}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </ProducerIntakeSectionShell>
  );
}

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
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { SHOW_MEDIA_MAX_BYTES } from "@/lib/show-media-upload-policy";
import { attachmentsBucketConfigured } from "@/lib/s3-project-attachments";

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
  project: Pick<
    ProducerIntakeDetailProject,
    "id" | "showMediaDirectorVisible" | "showMediaItems"
  >;
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

  return (
    <section id="show-media" className="scroll-mt-6 mt-10">
      <h2 className="text-sm font-medium text-zinc-200">Show media (v2)</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Crew-facing playlists — upload audio and video cues in rundown order (browser sends bytes directly to S3; configure bucket CORS per <span className="font-mono">.env.example</span>); directors hear/watch from the Show workspace when
        you publish below. Playback uses the OS default audio device per product spec (browser); open each video in a new window
        for a second monitor. Files live in private S3 under{" "}
        <span className="font-mono text-zinc-500">project-show-media/</span>.{" "}
        <Link href="/producer/media-library" className="text-violet-400 underline hover:text-violet-300">
          Shared library
        </Link>{" "}
        holds cues you reuse across productions (import copies bytes into this show).
      </p>
      {!s3Ok ? (
        <p className="mt-2 rounded border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100">
          S3 uploads disabled — configure <span className="font-mono">AWS_S3_ATTACHMENTS_BUCKET</span> (same bucket as confidential
          files).
        </p>
      ) : null}

      <form action={saveShowMediaVisibility} className="mt-4 rounded border border-zinc-800/80 bg-black/20 px-3 py-3">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            name="showMediaDirectorVisible"
            defaultChecked={project.showMediaDirectorVisible}
            value="on"
          />
          <span>Show playlists to directors (Show workspace playback)</span>
        </label>
        <button
          type="submit"
          className="mt-3 w-fit rounded border border-violet-800/70 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-900/50"
        >
          Save visibility
        </button>
      </form>

      {s3Ok ? (
        <div className="mt-6 space-y-5 rounded border border-zinc-800/80 bg-black/20 px-3 py-3">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Import without re-upload</h3>
            <p className="mt-1 text-[11px] text-zinc-600">
              Imports append to the lane of the source cue (S3 copy server-side). Requires{" "}
              <span className="font-mono text-zinc-500">s3:CopyObject</span> on bucket keys.
            </p>
          </div>

          <form
            action={importShowMediaFromLibrary}
            className="flex flex-col gap-3 border-t border-zinc-800/60 pt-4 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <input type="hidden" name="projectId" value={project.id} />
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
              <span className="text-zinc-400">Media library</span>
              <select
                name="libraryItemId"
                required
                disabled={libraryItems.length === 0}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 disabled:opacity-40"
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
            <button
              type="submit"
              disabled={libraryItems.length === 0}
              className="w-fit rounded bg-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Import library cue
            </button>
          </form>

          <form
            action={importShowMediaFromOtherProject}
            className="flex flex-col gap-3 border-t border-zinc-800/60 pt-4 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <input type="hidden" name="projectId" value={project.id} />
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
              <span className="text-zinc-400">Another submitted intake</span>
              <select
                name="sourceItemRef"
                required
                disabled={crossPickCount === 0}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 disabled:opacity-40"
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
            <button
              type="submit"
              disabled={crossPickCount === 0}
              className="w-fit rounded bg-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Import from other show
            </button>
          </form>

          {libraryItems.length === 0 ? (
            <p className="text-[11px] text-zinc-600">
              No rows in{" "}
              <Link href="/producer/media-library" className="text-violet-400 underline hover:text-violet-300">
                media library
              </Link>{" "}
              yet.
            </p>
          ) : null}
          {crossPickCount === 0 ? (
            <p className="text-[11px] text-zinc-600">No other submitted intakes have show media yet.</p>
          ) : null}
        </div>
      ) : null}

      {([ShowMediaLane.MUSIC, ShowMediaLane.VIDEO] as const).map((lane) => {
        const list = lane === ShowMediaLane.MUSIC ? music : video;
        const maxNote =
          lane === ShowMediaLane.MUSIC ? `${Math.round(maxMusicMb)} MB` : `${maxVideoGb} GB (product cap)`;
        return (
          <div key={lane} className="mt-8">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">{laneLabel(lane)} playlist</h3>
            <p className="mt-1 text-[11px] text-zinc-600">Max upload size: {maxNote}</p>
            <ShowMediaPresignedUploadForm
              presignPath="/api/producer/show-media/presign"
              projectId={project.id}
              lane={lane === ShowMediaLane.MUSIC ? "MUSIC" : "VIDEO"}
              disabled={!s3Ok}
              finalizeAction={finalizeShowMediaItemAfterS3Upload}
            />

            {list.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-600">No {laneLabel(lane).toLowerCase()} tracks yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {list.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-300 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-100">{item.fileName}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
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
                      <p className="mt-2">
                        <a
                          href={`/api/show-media/${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 underline hover:text-violet-300"
                        >
                          Preview stream
                        </a>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={reorderShowMediaItem} className="inline">
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          type="submit"
                          className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-900"
                          title="Move up"
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
                          className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-900"
                          title="Move down"
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
                          className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Duplicate (S3 copy)"
                        >
                          Duplicate
                        </button>
                      </form>
                      <form action={deleteShowMediaItem} className="inline">
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className="rounded border border-red-900/70 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40"
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
              <div className="mt-4 rounded border border-zinc-800/80 bg-black/25 px-3 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Rundown preview (director UX)</p>
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
    </section>
  );
}

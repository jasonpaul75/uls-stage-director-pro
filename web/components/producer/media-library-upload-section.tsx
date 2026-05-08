"use client";

import { useState } from "react";

import { finalizeShowMediaLibraryItemAfterS3Upload } from "@/app/producer/media-library/actions";
import {
  SHOW_MEDIA_MAX_BYTES,
  showMediaFriendlyTypeSummary,
} from "@/lib/show-media-upload-policy";

import { ShowMediaLane } from "@prisma/client";

import { ShowMediaPresignedUploadForm } from "./show-media-presigned-upload-form";

export function MediaLibraryUploadSection({ disabled }: { disabled: boolean }) {
  const [lane, setLane] = useState<"MUSIC" | "VIDEO">("MUSIC");

  const laneEnum = lane === "MUSIC" ? ShowMediaLane.MUSIC : ShowMediaLane.VIDEO;
  const maxMusicMb = SHOW_MEDIA_MAX_BYTES[ShowMediaLane.MUSIC] / (1024 * 1024);
  const maxVideoGb = SHOW_MEDIA_MAX_BYTES[ShowMediaLane.VIDEO] / (1024 * 1024 * 1024);
  const ceiling =
    lane === "MUSIC"
      ? `Most files should stay under ~${Math.round(maxMusicMb)} MB`
      : `Each file can be up to ~${maxVideoGb} GB`;

  return (
    <div className="mt-4 space-y-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Lane</span>
        <select
          value={lane}
          disabled={disabled}
          onChange={(e) => setLane(e.target.value as "MUSIC" | "VIDEO")}
          className="min-h-11 w-fit max-w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-40"
          aria-describedby="media-library-lane-hint"
        >
          <option value="MUSIC">Music</option>
          <option value="VIDEO">Video</option>
        </select>
      </label>
      <p id="media-library-lane-hint" className="text-[11px] leading-relaxed text-zinc-500">
        {ceiling}. {showMediaFriendlyTypeSummary(laneEnum)}
      </p>
      <ShowMediaPresignedUploadForm
        presignPath="/api/producer/media-library/presign"
        lane={lane}
        disabled={disabled}
        finalizeAction={finalizeShowMediaLibraryItemAfterS3Upload}
        uploadLabel="Upload to library"
      />
    </div>
  );
}

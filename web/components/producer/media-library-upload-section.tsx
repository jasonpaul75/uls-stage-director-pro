"use client";

import { useState } from "react";

import { finalizeShowMediaLibraryItemAfterS3Upload } from "@/app/producer/media-library/actions";

import { ShowMediaPresignedUploadForm } from "./show-media-presigned-upload-form";

export function MediaLibraryUploadSection({ disabled }: { disabled: boolean }) {
  const [lane, setLane] = useState<"MUSIC" | "VIDEO">("MUSIC");

  return (
    <div className="mt-4 space-y-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Lane</span>
        <select
          value={lane}
          disabled={disabled}
          onChange={(e) => setLane(e.target.value as "MUSIC" | "VIDEO")}
          className="w-fit rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 disabled:opacity-40"
        >
          <option value="MUSIC">Music</option>
          <option value="VIDEO">Video</option>
        </select>
      </label>
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

import { PortalDirectorShareUploadForm } from "@/components/portal-director-share-upload-form";
import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { attachmentsBucketConfigured } from "@/lib/s3-project-attachments";
import { directorShareFriendlyTypeSummary } from "@/lib/director-share-upload-policy";

import {
  deleteMyDirectorShare,
} from "@/app/portal/director-share-actions";

function formatMediaSize(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export type PortalDirectorShareRow = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  note: string | null;
  createdAt: Date;
  uploadedBy: { id: string; email: string | null; name: string | null };
};

export function PortalDirectorSharesSection(props: {
  projectId: string;
  portalReturn: "intake" | "show";
  viewerUserId: string;
  shares: PortalDirectorShareRow[];
  canUpload: boolean;
}) {
  const { projectId, portalReturn, viewerUserId, shares, canUpload } = props;
  const s3Ok = attachmentsBucketConfigured();

  return (
    <section id="portal-director-shares" className="scroll-mt-6 mt-10">
      <ProducerGlassCard>
        <h2 className="text-sm font-semibold text-uls-text">Files for production</h2>
        <p className="mt-1 text-xs leading-relaxed text-uls-muted">
          Share reference audio or video with ULS (national anthem cuts, logo stingers, rehearsal tracks). Uploads are scoped to
          this production only, separate from cue playlists in show media.
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[10px] text-uls-subtle">
          <li>Up to ~1 GB per file (same ceiling as reference video cue uploads).</li>
          <li>Separate from contractual / confidential intake attachments in storage.</li>
        </ul>
        <p className="mt-2 text-[10px] leading-relaxed text-uls-subtle">{directorShareFriendlyTypeSummary()}</p>
        {!s3Ok ? (
          <p className="mt-3 rounded-2xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-[11px] text-amber-50 backdrop-blur-sm">
            Uploads are unavailable — the server does not have object storage configured yet.
          </p>
        ) : null}
        {canUpload ? (
          <>
            <p className="mt-3 text-[11px] text-uls-subtle">
              Very large files may stall on weak networks — consider splitting stems if an upload repeatedly fails after presign.
            </p>
            <PortalDirectorShareUploadForm projectId={projectId} portalReturn={portalReturn} disabled={!s3Ok} />
          </>
        ) : (
          <p className="mt-3 text-[11px] text-uls-subtle">Director sign-in is required to upload — ULS admins use the producer inbox to download.</p>
        )}

        {shares.length === 0 ? (
          <p className="mt-4 text-sm text-uls-subtle">Nothing uploaded yet.</p>
        ) : (
          <ul className="mt-4 list-none space-y-3 pl-0">
            {shares.map((row) => (
              <li key={row.id} className="list-none">
                <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 text-xs text-uls-muted">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-uls-text">{row.fileName}</p>
                      <p className="mt-1 text-[10px] text-uls-subtle">
                        {formatMediaSize(row.sizeBytes)} · {row.contentType}
                        {row.uploadedBy.name?.trim() || row.uploadedBy.email
                          ? ` · From ${row.uploadedBy.name?.trim() || row.uploadedBy.email}`
                          : ""}{" "}
                        · {row.createdAt.toLocaleString()}
                      </p>
                      {row.note?.trim() ? (
                        <p className="mt-2 text-[11px] text-uls-muted">
                          <span className="font-medium text-uls-subtle">Note:</span> {row.note.trim()}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                      <a
                        href={`/api/director-shares/${row.id}`}
                        aria-label={`Download ${row.fileName}`}
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-center text-[11px] font-medium text-amber-100 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                      >
                        Download
                      </a>
                      {row.uploadedBy.id === viewerUserId ? (
                        <form action={deleteMyDirectorShare}>
                          <input type="hidden" name="shareId" value={row.id} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="portalReturn" value={portalReturn} />
                          <button
                            type="submit"
                            aria-label={`Remove ${row.fileName} from Production files`}
                            className="min-h-9 w-full rounded-lg border border-red-900/60 bg-red-950/35 px-3 py-1.5 text-[11px] text-red-100 hover:bg-red-950/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                          >
                            Remove
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ProducerGlassCard>
    </section>
  );
}

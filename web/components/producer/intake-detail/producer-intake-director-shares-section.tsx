import { deleteDirectorShareAsProducer } from "@/app/producer/inbox/director-share-actions";
import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { attachmentsBucketConfigured } from "@/lib/s3-project-attachments";
import { directorShareFriendlyTypeSummary } from "@/lib/director-share-upload-policy";

function formatMediaSize(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

type ShareRow = ProducerIntakeDetailProject["directorShares"][number];

export function ProducerIntakeDirectorSharesSection(props: {
  projectId: string;
  shares: ShareRow[];
  returnTo: "intake" | "event";
}) {
  const { projectId, shares, returnTo } = props;
  const s3Ok = attachmentsBucketConfigured();

  return (
    <section id="director-shares-production" className="scroll-mt-6 mt-10">
      <ProducerGlassCard>
        <h2 className="text-sm font-semibold text-uls-text">Director production files</h2>
        <p className="mt-1 text-xs leading-relaxed text-uls-muted">
          Reference music and video the client uploaded for this show (not the curated show-media playlists). Download originals
          here; directors manage their own removals from the portal.
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-uls-subtle">{directorShareFriendlyTypeSummary()}</p>
        {!s3Ok ? (
          <p className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-[11px] text-amber-50 backdrop-blur-sm">
            Configure <span className="font-mono">AWS_S3_ATTACHMENTS_BUCKET</span> to retrieve bytes.
          </p>
        ) : null}
        {shares.length === 0 ? (
          <p className="mt-4 text-sm text-uls-subtle">No director uploads yet.</p>
        ) : (
          <ul className="mt-4 list-none space-y-3 pl-0">
            {shares.map((row) => (
              <li key={row.id} className="list-none">
                <div className="flex flex-col gap-2 rounded-xl border border-uls-border bg-uls-surface/50 px-3 py-3 text-xs text-uls-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-uls-text">{row.fileName}</p>
                    <p className="mt-0.5 text-[10px] text-uls-subtle">
                      {formatMediaSize(row.sizeBytes)} · {row.contentType} ·{" "}
                      {(row.uploadedBy.name ?? "").trim() || row.uploadedBy.email || "Director"}{" "}
                      · {row.createdAt.toLocaleString()}
                    </p>
                    {row.note?.trim() ? (
                      <p className="mt-1 text-[11px] text-uls-muted">{row.note.trim()}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/director-shares/${row.id}`}
                      className={buttonLinkClass}
                      aria-label={`Download ${row.fileName}`}
                    >
                      Download
                    </a>
                    <form action={deleteDirectorShareAsProducer}>
                      <input type="hidden" name="shareId" value={row.id} />
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button
                        type="submit"
                        aria-label={`Remove director production file ${row.fileName}`}
                        className="min-h-9 rounded-lg border border-red-900/55 bg-red-950/35 px-3 py-1.5 text-[11px] text-red-200 transition hover:bg-red-950/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                      >
                        Remove
                      </button>
                    </form>
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

const buttonLinkClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-violet-800/70 bg-violet-950/40 px-3 py-1.5 text-[11px] font-medium text-violet-100 hover:bg-violet-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

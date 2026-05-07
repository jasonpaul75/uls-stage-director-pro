import Link from "next/link";

import { deleteProjectAttachment, uploadProjectAttachment } from "@/app/producer/inbox/attachment-actions";
import { attachmentsBucketConfigured } from "@/lib/s3-project-attachments";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { ProjectAttachmentKind } from "@prisma/client";

type Row = ProducerIntakeDetailProject["attachments"][number];

function kindLabel(k: ProjectAttachmentKind): string {
  switch (k) {
    case ProjectAttachmentKind.CONTRACT:
      return "Contract / agreement file";
    case ProjectAttachmentKind.INSURANCE_COMPLIANCE:
      return "Insurance & compliance";
    default:
      return String(k);
  }
}

function formatKb(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${Math.round(n / 1024)} KB`;
}

export function ProducerIntakeConfidentialFilesSection(props: {
  projectId: string;
  attachments: Row[];
}) {
  const { projectId, attachments } = props;
  const s3 = attachmentsBucketConfigured();

  return (
    <section id="uls-confidential-files" className="scroll-mt-6 mt-10">
      <h2 className="text-sm font-medium text-zinc-200">Confidential files (ULS only)</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Store agreement PDFs and insurance/compliance artifacts ULS controls. Directors never see this block — downloads are
        production-authenticated only. DocuSign remains the signing system of record; this is separate document retention in
        your bucket.
      </p>
      {!s3 ? (
        <p className="mt-3 rounded border border-amber-900/55 bg-amber-950/25 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
          Configure <span className="font-mono text-amber-200/90">AWS_S3_ATTACHMENTS_BUCKET</span> (and AWS credentials /
          region) before uploads succeed. Objects are private; the app signs short-lived GET URLs for producers.
        </p>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="mt-4 space-y-2 text-xs text-zinc-300">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{a.fileName}</p>
                <p className="text-[10px] text-zinc-500">
                  {kindLabel(a.kind)} · {formatKb(a.sizeBytes)} ·{" "}
                  {(a.uploadedBy.name ?? "").trim() || a.uploadedBy.email} ·{" "}
                  {a.createdAt.toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href={`/api/producer/attachments/${a.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800"
                >
                  Download
                </Link>
                <form action={deleteProjectAttachment}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="attachmentId" value={a.id} />
                  <button
                    type="submit"
                    className="text-[11px] text-red-400/90 underline-offset-2 hover:text-red-300 hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-zinc-600">No confidential uploads yet.</p>
      )}

      <form action={uploadProjectAttachment} className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="projectId" value={projectId} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Classification</span>
          <select name="kind" required className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100">
            <option value="CONTRACT">Contract / agreement file</option>
            <option value="INSURANCE_COMPLIANCE">Insurance &amp; compliance</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">File</span>
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            disabled={!s3}
            className="text-xs text-zinc-300 file:mr-3 file:rounded file:border file:border-zinc-600 file:bg-zinc-900 file:px-2 file:py-1 file:text-zinc-200 disabled:opacity-40"
          />
        </label>
        <button
          type="submit"
          disabled={!s3}
          className="w-fit rounded border border-amber-800/70 bg-amber-950/30 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Upload confidential file
        </button>
      </form>
    </section>
  );
}

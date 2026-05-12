import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Button } from "@/components/ui";
import { attachmentsBucketConfigured } from "@/lib/s3-project-attachments";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole } from "@prisma/client";

import { uploadStaffTaxDocument } from "../actions";

type Props = { searchParams?: Promise<Record<string, string | undefined>> };

const inputClass = "rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 text-sm text-uls-text";

export default async function StaffTaxPage(props: Props) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.globalRole;
  if (!userId || role !== GlobalRole.STAFF) return null;

  const sp = (await props.searchParams) ?? {};
  const bucketOk = attachmentsBucketConfigured();

  const docs = await prisma.staffTaxDocument.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, kind: true, fileName: true, uploadedAt: true, sizeBytes: true },
  });

  const err =
    sp.tax_err === "storage"
      ? "File storage is not configured — contact production."
      : sp.tax_err === "bad_kind"
        ? "Pick W‑9 or W‑2-class upload."
        : sp.tax_err === "empty"
          ? "Choose a PDF before uploading."
          : sp.tax_err === "large"
            ? "PDF is too large (max 25 MB)."
            : sp.tax_err === "bad_type"
              ? "Only PDF uploads are accepted."
              : sp.tax_err === "server"
                ? "Upload failed — retry shortly."
                : null;

  return (
    <AppShell id="staff-main-content" outerMaxWidth="standard" contentMaxWidth="full" className="pt-10">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Compliance</p>
        <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">Tax forms</h1>
        <p className="text-sm text-uls-muted">
          Upload signed PDF copies of your W‑9 or employer-provided W‑2-class statements. Production downloads via signed links for audit
          retention — keep HR originals elsewhere.
        </p>
      </header>

      {sp.tax_ok === "1" ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-emerald-500/25 bg-emerald-950/25">
          <p role="status" className="text-sm text-emerald-100">
            Upload saved — production can retrieve it from the intake crew workspace.
          </p>
        </ProducerGlassCard>
      ) : null}
      {err ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-rose-500/25 bg-rose-950/25">
          <p role="alert" className="text-sm text-rose-100">
            {err}
          </p>
        </ProducerGlassCard>
      ) : null}

      <ProducerGlassCard className="mt-8 space-y-4">
        <p className="text-sm font-semibold text-uls-text">Upload PDF</p>
        {!bucketOk ? (
          <p className="text-sm text-amber-200/90">Storage bucket missing in this environment — uploads are blocked.</p>
        ) : (
          <form action={uploadStaffTaxDocument} encType="multipart/form-data" className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-uls-muted">
              <span>Form type</span>
              <select name="kind" required className={inputClass}>
                <option value="W9">W‑9</option>
                <option value="W2">W‑2 (or equivalent)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-uls-muted">
              <span>PDF file</span>
              <input name="file" type="file" accept="application/pdf" required className={inputClass} />
            </label>
            <Button type="submit" variant="primary" size="sm" className="w-fit">
              Upload securely
            </Button>
          </form>
        )}
      </ProducerGlassCard>

      <ProducerGlassCard className="mt-8 space-y-3">
        <p className="text-sm font-semibold text-uls-text">Your uploads</p>
        {docs.length === 0 ? (
          <p className="text-sm text-uls-muted">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-uls-muted">
            {docs.map((d) => (
              <li key={d.id} className="rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2">
                <p className="font-medium text-uls-text">
                  {d.kind} · {d.fileName}
                </p>
                <p className="text-[11px] text-uls-subtle">
                  {d.uploadedAt.toISOString().slice(0, 10)} · {(d.sizeBytes / 1024).toFixed(1)} KB
                </p>
              </li>
            ))}
          </ul>
        )}
      </ProducerGlassCard>
    </AppShell>
  );
}

import { linkDocuSignEnvelopeToProject, unlinkDocuSignEnvelopeFromProject } from "@/app/producer/inbox/docusign-actions";
import { Button } from "@/components/ui";
import { docuSignProducerConsoleEnvelopeUrl } from "@/lib/docusign-admin";
import { docuSignEnvelopeStatusLabel } from "@/lib/docusign-envelope-ui";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { producerIntakeFieldClass, producerIntakeInsetFieldsetClass, producerIntakeMutedBoxClass, producerIntakeMonoFieldClass } from "@/lib/producer-intake-ui";
import { formatStripeRecordSynced } from "@/lib/stripe-invoice-ui";

import { ProducerIntakeCollapsible } from "./producer-intake-collapsible";
import { ProducerIntakeSectionShell } from "./producer-intake-section-shell";

type EnvelopeRow = ProducerIntakeDetailProject["docuSignEnvelopes"][number];

export function ProducerIntakeContractsSection(props: {
  projectId: string;
  envelopes: EnvelopeRow[];
}) {
  const { projectId, envelopes } = props;

  return (
    <ProducerIntakeSectionShell
      id="contracts"
      title="Contracts (DocuSign)"
      description={
        <>
          <p>
            Draft and send envelopes in DocuSign, then paste the envelope GUID below so mirrored status reaches the portal.
            Signing and legal evidence stay in DocuSign — only metadata is cached here.
          </p>
          <ProducerIntakeCollapsible title="Webhook &amp; saving the link (short)" defaultOpen={false}>
            <p className="text-[11px] leading-relaxed text-uls-subtle">
              Submitting this form only saves the link; it does not ask DocuSign to send a webhook — you need a live envelope event
              or Connect test.
            </p>
          </ProducerIntakeCollapsible>
        </>
      }
    >
      <p className="rounded-md border border-amber-950/60 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-100/95">
        <span className="font-semibold">Important:</span> copy the GUID from the DocuSigned address bar (
        <span className="font-mono text-amber-200/90">…/send/documents/details/</span>) with Ctrl+V / Cmd+V —{" "}
        <span className="font-semibold">do not re-type</span>. A single wrong character looks like a valid UUID but will not
        match DocuSigned or Connect.
      </p>
      <form action={linkDocuSignEnvelopeToProject} className={`flex flex-col gap-3 ${producerIntakeInsetFieldsetClass}`}>
        <input type="hidden" name="projectId" value={projectId} />
        <label className="flex flex-col gap-1">
          <span className="text-uls-text">Envelope ID (GUID)</span>
          <input
            type="text"
            name="envelopeId"
            required
            placeholder="Paste 36-character GUID from the envelope URL in DocuSign"
            className={producerIntakeMonoFieldClass}
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-uls-muted">Memo / DocuSign email subject snapshot (optional)</span>
          <input
            type="text"
            name="subject"
            maxLength={300}
            className={producerIntakeFieldClass}
            placeholder='e.g. "ULS Stage — Acme gala production agreement"'
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-uls-muted">Internal producer-only note</span>
          <textarea name="producerNote" rows={2} maxLength={2000} className={producerIntakeFieldClass} />
        </label>
        <Button type="submit" variant="secondary" size="sm" className="w-fit border-indigo-800/70 bg-indigo-950/40 text-indigo-100 hover:bg-indigo-900/35">
          Link envelope to this production
        </Button>
      </form>

      {envelopes.length > 0 ? (
        <ul className="space-y-3 text-xs">
          {envelopes.map((env) => (
            <li key={env.id} className={producerIntakeMutedBoxClass}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-uls-text">{docuSignEnvelopeStatusLabel(env.status)}</span>
                {env.subject ? <span className="text-uls-subtle">{env.subject}</span> : null}
              </div>
              <p className="mt-1 font-mono text-[10px] text-uls-subtle">{env.envelopeId}</p>
              {!env.statusChangedAt ? (
                <p className="mt-1.5 text-[10px] leading-snug text-amber-500/95">
                  Stuck here but Vercel shows POST&nbsp;200? Compare this ID to DocuSigned URL — any mismatch prevents updates.
                  Remove tracking row → paste GUID again from the browser bar only.
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-uls-subtle">
                Cached status updated{" "}
                {env.statusChangedAt ? formatStripeRecordSynced(env.statusChangedAt) : "pending first Connect event"}
              </p>
              {!env.statusChangedAt ? (
                <ProducerIntakeCollapsible title="DocuSign Connect troubleshooting" defaultOpen>
                  <p className="mt-2 max-w-prose text-[10px] leading-relaxed text-uls-muted">
                    If DocuSign never hits your server, the usual miss is configuring Connect under{" "}
                    <span className="font-mono text-uls-subtle">admin.docusign.com</span> while the envelope ran in demo — use{" "}
                    <a
                      href="https://admindemo.docusign.com/authenticate?goTo=connect"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      admindemo.docusign.com → Connect
                    </a>{" "}
                    for <span className="font-mono text-uls-subtle">apps-d</span> envelopes. In{" "}
                    <span className="font-medium text-uls-text">Event Settings</span>, turn on concrete triggers (e.g. envelope
                    sent / completed — if nothing is checked, DocuSign sends zero POSTs). Data format must be JSON / JSON SIM per
                    {" this app's webhook"}. Confirm Connect logs (listener log / failures tab) once{" "}
                    <span className="font-semibold text-uls-text">after</span> saving — same screen as where you pasted the URL (
                    Enable Log checked). Historical envelopes rarely backfill; create{" "}
                    <span className="font-semibold text-uls-text">after</span> Connect is Active. Then watch Vercel for{" "}
                    <span className="font-mono text-uls-subtle">POST /api/webhooks/docusign</span>.{" "}
                    <code className="rounded bg-uls-surface-inset px-1 py-px font-mono text-uls-subtle">DOCUSIGN_USE_DEMO=true</code>{" "}
                    only affects console links, not webhook routing.
                  </p>
                </ProducerIntakeCollapsible>
              ) : null}
              {env.completedAt ? (
                <p className="text-[11px] text-emerald-500/95">Completed {formatStripeRecordSynced(env.completedAt)}</p>
              ) : null}
              {env.voidedAt ? (
                <p className="text-[11px] text-amber-500/90">Voided {formatStripeRecordSynced(env.voidedAt)}</p>
              ) : null}
              {env.lastWebhookEvent ? (
                <p className="text-[10px] text-uls-subtle">Last event: {env.lastWebhookEvent}</p>
              ) : null}
              {env.producerNote?.trim() ? (
                <p className="mt-2 whitespace-pre-wrap text-[11px] text-uls-muted">{env.producerNote.trim()}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                <a
                  href={docuSignProducerConsoleEnvelopeUrl(env.envelopeId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  Open envelope in DocuSign
                </a>
                <form action={unlinkDocuSignEnvelopeFromProject} className="inline">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="rowId" value={env.id} />
                  <button type="submit" className="text-[11px] text-red-400/95 underline underline-offset-2 hover:text-red-300">
                    Remove tracking row
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-uls-subtle">
          Link envelopes so ULS can mirror DocuSigned status — directors only see the Contracts block when you enable it under
          Director portal visibility above.
        </p>
      )}
    </ProducerIntakeSectionShell>
  );
}

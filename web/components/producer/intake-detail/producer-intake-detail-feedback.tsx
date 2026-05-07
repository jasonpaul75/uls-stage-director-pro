import type { ProducerIntakeDetailProject, ProducerIntakeDetailSearchParams } from "@/lib/producer-intake-detail";
import {
  PRODUCER_INTAKE_DOCUSIGN_ERR_COPY,
  PRODUCER_INTAKE_INVITE_ERR_COPY,
  PRODUCER_INTAKE_STRIPE_ERR_COPY,
} from "@/lib/producer-intake-detail-feedback-copy";
import { PRODUCER_INTAKE_ATTACH_ERR_COPY } from "@/lib/producer-intake-attachment-err-copy";
import { PRODUCER_INTAKE_SHOW_MEDIA_ERR_COPY } from "@/lib/producer-intake-show-media-err-copy";

export function ProducerIntakeIntegrationWarnings(props: {
  webhookOk: boolean;
  docusignConnectOk: boolean;
  appBase: string;
}) {
  const { webhookOk, docusignConnectOk, appBase } = props;
  return (
    <>
      {!webhookOk ? (
        <p className="mt-3 rounded border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          Stripe webhooks inactive — set STRIPE_WEBHOOK_SECRET then point Stripe to{" "}
          <code className="rounded bg-black/50 px-1 py-0.5 text-[11px]">
            {appBase}/api/webhooks/stripe
          </code>{" "}
          so invoices sync into this inbox.
        </p>
      ) : null}
      {!docusignConnectOk ? (
        <p className="mt-3 rounded border border-indigo-900/65 bg-indigo-950/25 px-3 py-2 text-[11px] leading-relaxed text-indigo-100">
          DocuSign Connect inactive — create <span className="font-mono">DOCUSIGN_CONNECT_HMAC_SECRET</span> then add a JSON
          SIM Connect URL to{" "}
          <span className="font-mono text-indigo-200">
            {appBase}/api/webhooks/docusign
          </span>{" "}
          (Basic HMAC, signature&nbsp;1) so envelope statuses mirror here automatically.
        </p>
      ) : null}
    </>
  );
}

export function ProducerIntakeFlashMessages(props: {
  sp: ProducerIntakeDetailSearchParams;
  project: ProducerIntakeDetailProject;
}) {
  const { sp, project } = props;
  return (
    <>
      {sp.saved === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Saved internal fields.
        </p>
      ) : null}
      {sp.invite_sent === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Director invite emailed. They&apos;ll finish setup from the secure link (valid one week).
          {sp.invite_resend === "1" ? " (Earlier unused invite links for that address stopped working.)" : ""}
        </p>
      ) : null}
      {typeof sp.invite_err === "string" && PRODUCER_INTAKE_INVITE_ERR_COPY[sp.invite_err] ? (
        <p className="mt-3 text-sm text-red-400">{PRODUCER_INTAKE_INVITE_ERR_COPY[sp.invite_err]}</p>
      ) : typeof sp.invite_err === "string" ? (
        <p className="mt-3 text-sm text-red-400">Couldn&apos;t send the invite.</p>
      ) : null}
      {sp.error === "bad_assignee" ? (
        <p className="mt-3 text-sm text-red-400">Invalid assignee selected.</p>
      ) : null}

      {sp.booking_confirmed === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Booking secured — directors now use the portal show workspace for operational content (and remain on intake for
          proposal and commercial sections until you adjust toggles).
        </p>
      ) : null}

      {sp.event_locked === "1" ? (
        <p className="mt-3 rounded border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          Event workspace is locked until DocuSign shows a completed contract and at least one Stripe invoice sync’d here is
          paid. Finish those steps below, then use &ldquo;Open Event workspace&rdquo;.
        </p>
      ) : null}

      {sp.stripe_customer === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Stripe customer linked (Standard ULS account). You can draft a phased deposit invoice next.
        </p>
      ) : null}
      {sp.stripe_invoice === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Stripe draft invoice created — add lines, finalize/send from here or the Dashboard; status updates arrive via
          webhook.
        </p>
      ) : null}
      {sp.stripe_sent === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Invoice finalized and emailed via Stripe’s send flow (customer-facing link arrives from Stripe).
        </p>
      ) : null}
      {sp.stripe_line === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Line item added to the draft invoice.
        </p>
      ) : null}
      {sp.stripe_cancelled === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Stripe invoice discarded (draft) or voided (open) per your selection.
        </p>
      ) : null}
      {sp.stripe_synced === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Stripe invoice refreshed from the API — attempt counts and balances should match Dashboard (webhooks remain the
          default path).
        </p>
      ) : null}
      {typeof sp.stripe_err === "string" && PRODUCER_INTAKE_STRIPE_ERR_COPY[sp.stripe_err] ? (
        <p className="mt-3 text-sm text-red-400">{PRODUCER_INTAKE_STRIPE_ERR_COPY[sp.stripe_err]}</p>
      ) : typeof sp.stripe_err === "string" ? (
        <p className="mt-3 text-sm text-red-400">Stripe action failed.</p>
      ) : null}
      {sp.proposal_saved === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Proposal draft saved.
          {project.proposalDirectorVisible ||
          project.contractsDirectorVisible ||
          project.stripeBillingDirectorVisible ||
          project.postEventVaultDirectorVisible ||
          project.showDayFlagsDirectorVisible ||
          project.runOfShowDirectorVisible
            ? " Directors see whatever you’ve turned on under “Director portal visibility” below."
            : " Turn on the director portal checkboxes when proposal, contracts, billing, or post-event links are ready to show."}
        </p>
      ) : null}
      {sp.docusign_linked === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          DocuSign envelope linked — status updates arrive after Connect publishes events.
        </p>
      ) : null}
      {sp.docusign_removed === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          DocuSign tracking row removed locally (does not void envelopes in DocuSign).
        </p>
      ) : null}
      {typeof sp.docusign_err === "string" && PRODUCER_INTAKE_DOCUSIGN_ERR_COPY[sp.docusign_err] ? (
        <p className="mt-3 text-sm text-red-400">{PRODUCER_INTAKE_DOCUSIGN_ERR_COPY[sp.docusign_err]}</p>
      ) : typeof sp.docusign_err === "string" ? (
        <p className="mt-3 text-sm text-red-400">DocuSign action failed.</p>
      ) : null}
      {sp.post_event_saved === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Post-event delivery pointers saved.
        </p>
      ) : null}
      {sp.post_event_err === "bad_url" ? (
        <p className="mt-3 text-sm text-red-400">
          Each URL must be a full <span className="font-mono">https://</span> link. Clear the field or fix the address.
        </p>
      ) : null}
      {sp.flag_added === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Show-day flag added.
        </p>
      ) : null}
      {sp.flag_removed === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Show-day flag removed.
        </p>
      ) : null}
      {sp.flags_visibility_saved === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Show-day visibility saved.
        </p>
      ) : null}
      {sp.flag_err === "required" ? (
        <p className="mt-3 text-sm text-red-400">Enter flag text before adding.</p>
      ) : null}
      {sp.ros_saved === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Run of show saved.
        </p>
      ) : null}
      {sp.attach_uploaded === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Confidential file uploaded to private storage.
        </p>
      ) : null}
      {sp.attach_deleted === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Attachment removed from records and private storage.
        </p>
      ) : null}
      {typeof sp.attach_err === "string" && PRODUCER_INTAKE_ATTACH_ERR_COPY[sp.attach_err] ? (
        <p className="mt-3 text-sm text-red-400">{PRODUCER_INTAKE_ATTACH_ERR_COPY[sp.attach_err]}</p>
      ) : typeof sp.attach_err === "string" ? (
        <p className="mt-3 text-sm text-red-400">Attachment action failed.</p>
      ) : null}
      {sp.media_uploaded === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Show media track uploaded.
        </p>
      ) : null}
      {sp.media_deleted === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Show media track removed.
        </p>
      ) : null}
      {sp.media_visibility_saved === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Show media visibility saved.
        </p>
      ) : null}
      {sp.media_reordered === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Playlist order updated.
        </p>
      ) : null}
      {sp.media_duplicated === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Cue duplicated — a new row was added at the end of that lane (S3 copy).
        </p>
      ) : null}
      {sp.media_imported === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Cue imported into this playlist (S3 copy).
        </p>
      ) : null}
      {typeof sp.media_err === "string" && PRODUCER_INTAKE_SHOW_MEDIA_ERR_COPY[sp.media_err] ? (
        <p className="mt-3 text-sm text-red-400">{PRODUCER_INTAKE_SHOW_MEDIA_ERR_COPY[sp.media_err]}</p>
      ) : typeof sp.media_err === "string" ? (
        <p className="mt-3 text-sm text-red-400">Show media action failed.</p>
      ) : null}
    </>
  );
}

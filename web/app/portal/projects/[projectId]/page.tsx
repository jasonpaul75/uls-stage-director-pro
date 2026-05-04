import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { loadProjectForPortalViewer } from "@/lib/project-access-portal";
import { stripeSecretKeyAppearsSandbox } from "@/lib/stripe-admin";
import {
  formatMoneyFromCents,
  formatStripeRecordSynced,
  stripeDirectorOpenInvoiceAttemptsNote,
  stripeHasOpenBalanceDue,
  stripeInvoiceStatusLabel,
  stripeOpenInvoiceRetryGuide,
} from "@/lib/stripe-invoice-ui";
import { docuSignProducerConsoleEnvelopeUrl, docuSignRecipientDocumentsHubUrl } from "@/lib/docusign-admin";
import { docuSignEnvelopeStatusLabel } from "@/lib/docusign-envelope-ui";
import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
import { GlobalRole } from "@prisma/client";

type Props = { params: Promise<{ projectId: string }> };

function ProposalPanels(props: { title: string; body?: string | null }) {
  const text = props.body?.trim();
  if (!text) return null;

  return (
    <section>
      <h3 className="text-xs uppercase tracking-wide text-neutral-500">{props.title}</h3>
      <pre className="mt-2 whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
        {text}
      </pre>
    </section>
  );
}

export default async function PortalProjectDetailPage(props: Props) {
  const { projectId } = await props.params;
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole;
  if (!uid || role === undefined) {
    redirect("/login?callbackUrl=/portal");
  }

  const project = await loadProjectForPortalViewer(projectId, { userId: uid, globalRole: role });

  if (!project) notFound();

  const isAdmin = role === GlobalRole.ULS_ADMIN;
  if (!isAdmin && isDirectorPortalAccessRevoked(project.eventConclusionAt)) {
    redirect("/portal?access_ended=1");
  }

  const showProposal = project.proposalDirectorVisible || isAdmin;
  const showContracts = project.contractsDirectorVisible || isAdmin;
  const showStripe = project.stripeBillingDirectorVisible || isAdmin;
  const showVault = project.postEventVaultDirectorVisible || isAdmin;

  const hasVaultLinks =
    Boolean(project.postEventSmugMugUrl?.trim()) ||
    Boolean(project.postEventPageantExpressionsUrl?.trim()) ||
    Boolean(project.postEventCastrUrl?.trim());

  const directorSeesAnything =
    project.proposalDirectorVisible ||
    project.contractsDirectorVisible ||
    project.stripeBillingDirectorVisible ||
    project.postEventVaultDirectorVisible;

  const hasAnyProposal =
    Boolean(project.proposalPricingNotes?.trim()) ||
    Boolean(project.proposalTechRiderNotes?.trim()) ||
    Boolean(project.proposalCrewNotes?.trim());
  const hasDocuSignRows = project.docuSignEnvelopes.length > 0;
  const hasStripeRows = project.stripeInvoices.length > 0;

  const adminHasUnpublishedDirectorContent =
    isAdmin &&
    ((!project.proposalDirectorVisible && hasAnyProposal) ||
      (!project.contractsDirectorVisible && hasDocuSignRows) ||
      (!project.stripeBillingDirectorVisible && hasStripeRows) ||
      (!project.postEventVaultDirectorVisible && hasVaultLinks));

  const stripeSandbox = stripeSecretKeyAppearsSandbox();
  const openInvoicesOnly = project.stripeInvoices.filter((inv) => inv.status === "open");
  let combinedOpenDueCents = 0;
  const openInvoiceCurrencies = new Set<string>();
  for (const inv of openInvoicesOnly) {
    if (typeof inv.amountDueCents === "number" && inv.amountDueCents > 0) {
      combinedOpenDueCents += inv.amountDueCents;
    }
    openInvoiceCurrencies.add(inv.currency.toUpperCase() || "USD");
  }
  const openDueSingleCurrency = openInvoiceCurrencies.size === 1 ? [...openInvoiceCurrencies][0] : null;
  const openBalanceRetryHint = stripeHasOpenBalanceDue(project.stripeInvoices);

  return (
    <main className="mx-auto max-w-lg p-8">
      <nav className="text-sm text-neutral-600">
        <Link href="/portal" className="text-amber-500 hover:text-amber-400">
          ← Portal
        </Link>
        {" · "}
        <Link href={`/portal/projects/${projectId}/support`} className="text-amber-500/90 hover:text-amber-400">
          Support
        </Link>
      </nav>
      <p className="mt-6 text-xs uppercase tracking-widest text-amber-500">Production</p>
      <h1 className="mt-1 text-2xl font-semibold text-neutral-100">{project.name}</h1>

      <dl className="mt-8 space-y-3 text-sm text-neutral-300">
        <div>
          <dt className="text-neutral-500">Status</dt>
          <dd>
            {project.status === "INTAKE_SUBMITTED" ? "Queued for ULS" : project.status}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Venue</dt>
          <dd>
            {project.venue ?? "—"}
            {project.cityState ? ` · ${project.cityState}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Submitted</dt>
          <dd>{project.submittedAt ? project.submittedAt.toLocaleString() : "—"}</dd>
        </div>
        {(project.requestedEventStart || project.requestedEventEnd) && (
          <div>
            <dt className="text-neutral-500">Requested dates</dt>
            <dd>
              {project.requestedEventStart?.toISOString().slice(0, 10) ?? "—"} →{" "}
              {project.requestedEventEnd?.toISOString().slice(0, 10) ?? "—"}
            </dd>
          </div>
        )}
        {typeof project.contestantApprox === "number" ? (
          <div>
            <dt className="text-neutral-500">Contestants (approx)</dt>
            <dd>{project.contestantApprox}</dd>
          </div>
        ) : null}
      </dl>

      {(project.categoryNotes?.trim() ||
        project.livestreamNotes?.trim() ||
        project.budgetNotes?.trim() ||
        project.additionalNotes?.trim()) && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-neutral-200">Your intake summary</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Same details you submitted — ULS may refine scope as the production firms up.
          </p>
          <div className="mt-4 space-y-5 text-sm">
            {project.categoryNotes?.trim() ? (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-neutral-500">Categories</h3>
                <pre className="mt-2 whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-300">
                  {project.categoryNotes.trim()}
                </pre>
              </div>
            ) : null}
            {project.livestreamNotes?.trim() ? (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-neutral-500">Livestream</h3>
                <pre className="mt-2 whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-300">
                  {project.livestreamNotes.trim()}
                </pre>
              </div>
            ) : null}
            {project.budgetNotes?.trim() ? (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-neutral-500">Budget</h3>
                <pre className="mt-2 whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-300">
                  {project.budgetNotes.trim()}
                </pre>
              </div>
            ) : null}
            {project.additionalNotes?.trim() ? (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-neutral-500">Your notes</h3>
                <pre className="mt-2 whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-300">
                  {project.additionalNotes.trim()}
                </pre>
              </div>
            ) : null}
          </div>
        </section>
      )}

      <div className="mt-10 space-y-6">
        {!isAdmin && !directorSeesAnything ? (
          <p className="text-sm text-neutral-400">
            ULS hasn&apos;t opened any director-facing sections yet. When your producer enables proposal notes, mirrored
            DocuSign contracts, Stripe billing, and/or post-event delivery links on this production, they&apos;ll show up here
            automatically.
          </p>
        ) : null}

        {adminHasUnpublishedDirectorContent ? (
          <p className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
            ULS-admin preview — unchecked items in &ldquo;Director portal visibility&rdquo; on the producer inbox stay hidden from
            directors even though you can see them below.
          </p>
        ) : null}

        {showProposal && !hasAnyProposal ? (
          <p className="text-sm text-neutral-500">
            Proposal sections aren&apos;t filled in yet — check back soon.
          </p>
        ) : null}

        {showProposal ? (
          <div className="space-y-6">
            <ProposalPanels title="Pricing & milestones" body={project.proposalPricingNotes} />
            <ProposalPanels title="Technical & rider cues" body={project.proposalTechRiderNotes} />
            <ProposalPanels title="Crew & rehearsal rhythm" body={project.proposalCrewNotes} />
          </div>
        ) : null}
      </div>

      {showContracts && hasDocuSignRows ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-neutral-200">Contracts &amp; signatures</h2>
          <p className="mt-1 text-xs text-neutral-500">
            DocuSign is the legal record for signatures. This portal only mirrors status;{" "}
            <span className="text-neutral-400">signing usually happens from DocuSigned email or your DocuSigned inbox</span>, not
            the link below (which often opens the sender view for ULS accounts).
          </p>
          <ul className="mt-4 space-y-3">
            {project.docuSignEnvelopes.map((env) => (
              <li
                key={env.id}
                className="rounded border border-neutral-800 bg-neutral-950/75 px-3 py-2 text-xs text-neutral-300"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-neutral-100">{docuSignEnvelopeStatusLabel(env.status)}</span>
                  {env.subject ? (
                    <span className="text-neutral-400">{env.subject}</span>
                  ) : (
                    <span className="text-neutral-600">Agreement</span>
                  )}
                </div>
                <p className="mt-2 font-mono text-[10px] text-neutral-600">{env.envelopeId}</p>
                <p className="mt-1 text-neutral-400">
                  {env.completedAt ? (
                    <span className="text-emerald-400/95">
                      Completed {formatStripeRecordSynced(env.completedAt)}.
                    </span>
                  ) : env.voidedAt ? (
                    <span className="text-amber-400/95">Voided {formatStripeRecordSynced(env.voidedAt)}.</span>
                  ) : env.statusChangedAt ? (
                    <span>Last update {formatStripeRecordSynced(env.statusChangedAt)}.</span>
                  ) : (
                    <span>Waiting for the next mirrored status from DocuSign.</span>
                  )}
                </p>
                {env.lastWebhookEvent?.trim() ? (
                  <p className="mt-2 text-[10px] text-neutral-600">Last event: {env.lastWebhookEvent.trim()}</p>
                ) : null}
                {env.completedAt ? (
                  <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                    Signed PDFs and final packets live in DocuSign — use DocuSigned email receipts or your DocuSign account &ldquo;Completed&rdquo; folder to download copies. This portal does not store contract files.
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  <a
                    href={docuSignRecipientDocumentsHubUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-500/95 hover:text-amber-400"
                  >
                    DocuSigned inbox (sign or review)
                  </a>
                  <a
                    href={docuSignProducerConsoleEnvelopeUrl(env.envelopeId)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-400 hover:text-neutral-300"
                  >
                    Open envelope (send/manage view)
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showStripe && hasStripeRows ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-neutral-200">Invoices &amp; payments</h2>
          <p className="mt-1 text-xs text-neutral-500">
            ULS sends Stripe-hosted invoices when billing is finalized. Pay from the button below once a link appears — no
            account required on this portal.
          </p>
          {stripeSandbox ? (
            <p className="mt-3 rounded border border-sky-900/55 bg-sky-950/30 px-3 py-2 text-[11px] leading-relaxed text-sky-100">
              <span className="font-semibold">Test invoices:</span> Use Stripe&apos;s{" "}
              <span className="font-medium">4242&nbsp;4242&nbsp;4242&nbsp;4242</span> card numbers or other test methods.
              Nothing here moves real money until ULS switches to live Stripe keys.
            </p>
          ) : (
            <p className="mt-3 rounded border border-emerald-950/55 bg-emerald-950/20 px-3 py-2 text-[11px] leading-relaxed text-emerald-100">
              <span className="font-semibold">Live billing:</span> Successful payments settle to ULS on Stripe&apos;s timetable.
              Pull PDF receipts from each hosted invoice link.
            </p>
          )}
          {combinedOpenDueCents > 0 && openDueSingleCurrency ? (
            <p className="mt-3 rounded border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-[11px] text-neutral-200">
              Across <strong className="text-neutral-100">open</strong> (payable) invoices below, roughly{" "}
              <strong className="text-neutral-100">
                {formatMoneyFromCents(combinedOpenDueCents, openDueSingleCurrency)}
              </strong>{" "}
              remains due — totals exclude drafts until they are finalized and emailed.
            </p>
          ) : null}
          {combinedOpenDueCents > 0 && !openDueSingleCurrency ? (
            <p className="mt-3 rounded border border-amber-900/45 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-100">
              Multiple currencies among open invoices — pay each Stripe link separately rather than quoting one balance.
            </p>
          ) : null}
          {openBalanceRetryHint ? (
            <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">{stripeOpenInvoiceRetryGuide}</p>
          ) : null}
          <ul className="mt-4 space-y-3">
            {project.stripeInvoices.map((inv) => {
              const attemptsNote = stripeDirectorOpenInvoiceAttemptsNote(inv);

              return (
                <li
                  key={inv.id}
                  className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-3 text-sm text-neutral-300"
                >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium text-neutral-100">{stripeInvoiceStatusLabel(inv.status)}</p>
                    {inv.invoiceNumber ? (
                      <p className="text-xs text-neutral-500">Invoice #{inv.invoiceNumber}</p>
                    ) : null}
                  </div>
                  {typeof inv.amountDueCents === "number" ? (
                    <p className="text-neutral-400">
                      {inv.amountDueCents <= 0 || inv.status === "paid"
                        ? inv.status === "paid"
                          ? "Paid"
                          : "No balance due"
                        : `${formatMoneyFromCents(inv.amountDueCents, inv.currency)} due`}
                    </p>
                  ) : null}
                </div>
                <p className="mt-2 text-[10px] text-neutral-600">
                  Updated {formatStripeRecordSynced(inv.updatedAt)}
                </p>
                {attemptsNote ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-200/85">{attemptsNote}</p>
                ) : null}
                {inv.lastStripeErrorSummary &&
                inv.status === "open" &&
                typeof inv.amountDueCents === "number" &&
                inv.amountDueCents > 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-rose-200/85">
                    <span className="font-semibold text-rose-100/95">Stripe notice:</span>{" "}
                    {inv.lastStripeErrorSummary}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  {inv.hostedInvoiceUrl && (inv.status === "open" || inv.status === "draft") ? (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-center text-sm font-medium text-black hover:bg-amber-500"
                    >
                      View or pay invoice
                    </a>
                  ) : null}
                  {inv.hostedInvoiceUrl && inv.status === "paid" ? (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-lg border border-neutral-600 px-4 py-2 text-center text-sm font-medium text-neutral-100 hover:bg-neutral-900"
                    >
                      Invoice &amp; receipt
                    </a>
                  ) : null}
                  {!inv.hostedInvoiceUrl && inv.status === "open" ? (
                    <p className="text-xs text-amber-200/90">
                      Your pay link isn&apos;t synced yet — refresh shortly or email your ULS producer if this persists.
                    </p>
                  ) : null}
                  {inv.status === "paid" && !inv.hostedInvoiceUrl ? (
                    <p className="text-xs text-neutral-500">Thank you — this invoice is settled in Stripe.</p>
                  ) : null}
                  {inv.status === "draft" && !inv.hostedInvoiceUrl ? (
                    <p className="text-xs text-neutral-500">
                      ULS is still drafting this invoice. You&apos;ll receive email from Stripe when it&apos;s sent.
                    </p>
                  ) : null}
                  {inv.status === "void" ? (
                    <p className="text-xs text-neutral-500">
                      This invoice was voided by ULS. Reach out if the paperwork doesn&apos;t match your expectations.
                    </p>
                  ) : null}
                  {inv.status === "uncollectible" ? (
                    <p className="text-xs text-rose-300/95">
                      Stripe marked this balance uncollectible. Contact your producer before attempting another payment —
                      don&apos;t resend funds without confirmation.
                    </p>
                  ) : null}
                </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {showVault ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-neutral-200">Post-event delivery</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Galleries and replays live on SmugMug, Pageant Expressions, and Castr — the portal only stores outbound links;
            usage and redistribution follow each platform and your contract.
          </p>
          {!hasVaultLinks ? (
            <p className="mt-4 text-sm text-neutral-500">
              Your producer will add SmugMug / pageant / livestream pointers here when they&apos;re ready to hand off.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {project.postEventSmugMugUrl?.trim() ? (
                <li className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">SmugMug</p>
                  <a
                    href={project.postEventSmugMugUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block break-all text-amber-400 hover:text-amber-300"
                  >
                    {project.postEventSmugMugUrl.trim()}
                  </a>
                </li>
              ) : null}
              {project.postEventPageantExpressionsUrl?.trim() ? (
                <li className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Pageant Expressions</p>
                  <a
                    href={project.postEventPageantExpressionsUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block break-all text-amber-400 hover:text-amber-300"
                  >
                    {project.postEventPageantExpressionsUrl.trim()}
                  </a>
                </li>
              ) : null}
              {project.postEventCastrUrl?.trim() ? (
                <li className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Castr</p>
                  <a
                    href={project.postEventCastrUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block break-all text-amber-400 hover:text-amber-300"
                  >
                    {project.postEventCastrUrl.trim()}
                  </a>
                </li>
              ) : null}
            </ul>
          )}
        </section>
      ) : null}

      <p className="mt-10 text-xs text-neutral-600">
        Questions about wording or schedules? Reach your assigned ULS producer — run-of-show and contracts will deepen
        here as milestones complete.
      </p>
    </main>
  );
}

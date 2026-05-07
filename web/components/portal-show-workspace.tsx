import type { loadProjectForPortalViewer } from "@/lib/project-access-portal";
import { parseHttpsUrl } from "@/lib/safe-https-url";
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
import { reorderShowMediaAsDirector } from "@/app/portal/show-media-reorder-actions";
import { PortalMusicSequentialPlayer } from "@/components/portal-show-media-playback";

export type PortalProjectLoaded = NonNullable<Awaited<ReturnType<typeof loadProjectForPortalViewer>>>;

type Props = {
  project: PortalProjectLoaded;
  isAdmin: boolean;
  /** Director may reorder published playlists once booking is secured — handled on the Show page wrapper. */
  viewerMayReorderShowMedia?: boolean;
};

/** Operational show workspace: run of show, contracts, billing, show-day flags, post-event — after booking is secured. */
export function PortalShowWorkspaceSections({
  project,
  isAdmin,
  viewerMayReorderShowMedia = false,
}: Props) {
  const showContracts = project.contractsDirectorVisible || isAdmin;
  const showStripe = project.stripeBillingDirectorVisible || isAdmin;
  const showVault = project.postEventVaultDirectorVisible || isAdmin;
  const showShowDay = project.showDayFlagsDirectorVisible || isAdmin;
  const showRunOfShow = project.runOfShowDirectorVisible || isAdmin;
  const mediaRows = project.showMediaItems ?? [];
  const showMediaBlock =
    (project.showMediaDirectorVisible || isAdmin) && mediaRows.length > 0;

  const musicItems = mediaRows.filter((i) => i.lane === "MUSIC");
  const videoItems = mediaRows.filter((i) => i.lane === "VIDEO");

  const rawSmug = project.postEventSmugMugUrl?.trim();
  const rawCastr = project.postEventCastrUrl?.trim();
  const smugSafe = rawSmug ? parseHttpsUrl(rawSmug) : null;
  const castrSafe = rawCastr ? parseHttpsUrl(rawCastr) : null;
  const hasVaultLinks = Boolean(smugSafe || castrSafe);
  const vaultUrlRejected = Boolean((rawSmug && !smugSafe) || (rawCastr && !castrSafe));
  const hasShowDayFlags = project.showDayFlags.length > 0;
  const hasRunOfShowBody = Boolean(project.runOfShowBody?.trim());
  const hasDocuSignRows = project.docuSignEnvelopes.length > 0;
  const hasStripeRows = project.stripeInvoices.length > 0;

  const adminHasUnpublishedOperational =
    isAdmin &&
    ((!project.runOfShowDirectorVisible && hasRunOfShowBody) ||
      (!project.showDayFlagsDirectorVisible && hasShowDayFlags) ||
      (!project.postEventVaultDirectorVisible && hasVaultLinks) ||
      (!project.showMediaDirectorVisible && (project.showMediaItems ?? []).length > 0));

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
    <>
      {adminHasUnpublishedOperational ? (
        <p className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
          ULS-admin preview — directors only see run of show / show media / show-day / post-event when those toggles are on in
          the producer inbox.
        </p>
      ) : null}

      {showRunOfShow ? (
        <section id="portal-run-of-show" className="scroll-mt-6 mt-10">
          <h2 className="text-sm font-medium text-neutral-200">Run of show</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Working schedule and cue narrative from ULS — not a substitute for your signed agreements or venue safety
            authority.
          </p>
          {project.runOfShowFrozen ? (
            <p className="mt-3 rounded border border-amber-900/55 bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
              <span className="font-semibold">Frozen:</span> show-window view only — comments aren&apos;t enabled here. Reach
              your producer for urgent changes.
            </p>
          ) : null}
          {!hasRunOfShowBody ? (
            <p className="mt-4 text-sm text-neutral-500">
              ULS hasn&apos;t published run-of-show text for this block yet — check back as load-in approaches.
            </p>
          ) : (
            <pre className="mt-4 whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm text-neutral-200">
              {project.runOfShowBody?.trim()}
            </pre>
          )}
        </section>
      ) : null}

      {showMediaBlock ? (
        <section id="portal-show-media" className="scroll-mt-6 mt-10">
          <h2 className="text-sm font-medium text-neutral-200">Show media</h2>
          <p className="mt-1 text-xs text-neutral-500">
            In-house cues from ULS — use the rundown player for music (auto-advances cue-to-cue). Open videos in sequence on a second
            display; follow <span className="text-neutral-400">next clip</span> links during show.
          </p>
          {!project.showMediaDirectorVisible && isAdmin ? (
            <p className="mt-3 rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
              ULS-admin preview — directors only see this block when <span className="font-medium">Show playlists</span> is
              enabled in the producer inbox.
            </p>
          ) : null}
          {musicItems.length === 0 && videoItems.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">No media rows on this production yet.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {musicItems.length > 0 ? (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">Music</h3>
                  <PortalMusicSequentialPlayer
                    tracks={musicItems.map((t) => ({
                      id: t.id,
                      fileName: t.fileName,
                      contentType: t.contentType,
                      sizeBytes: t.sizeBytes,
                    }))}
                    projectId={viewerMayReorderShowMedia ? project.id : undefined}
                    reorderAction={
                      viewerMayReorderShowMedia ? reorderShowMediaAsDirector : undefined
                    }
                  />
                </div>
              ) : null}
              {videoItems.length > 0 ? (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">Video</h3>
                  <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-neutral-200">
                    {videoItems.map((t, vi) => {
                      const next = videoItems[vi + 1];
                      return (
                        <li key={t.id} className="pl-1">
                          <span className="text-neutral-300">{t.fileName}</span>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {viewerMayReorderShowMedia ? (
                              <span className="inline-flex gap-1">
                                <form action={reorderShowMediaAsDirector} className="inline">
                                  <input type="hidden" name="projectId" value={project.id} />
                                  <input type="hidden" name="itemId" value={t.id} />
                                  <input type="hidden" name="direction" value="up" />
                                  <button
                                    type="submit"
                                    className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-900"
                                    title="Move up in rundown"
                                  >
                                    ↑
                                  </button>
                                </form>
                                <form action={reorderShowMediaAsDirector} className="inline">
                                  <input type="hidden" name="projectId" value={project.id} />
                                  <input type="hidden" name="itemId" value={t.id} />
                                  <input type="hidden" name="direction" value="down" />
                                  <button
                                    type="submit"
                                    className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-900"
                                    title="Move down in rundown"
                                  >
                                    ↓
                                  </button>
                                </form>
                              </span>
                            ) : null}
                            <a
                              href={`/api/show-media/${t.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-500 underline hover:text-amber-400"
                            >
                              Open in new window
                            </a>
                            {next ? (
                              <a
                                href={`/api/show-media/${next.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-neutral-500 underline hover:text-neutral-300"
                              >
                                Next clip → {next.fileName}
                              </a>
                            ) : (
                              <span className="text-[11px] text-neutral-600">Last clip in rundown</span>
                            )}
                          </div>
                          <span className="mt-1 block text-[11px] text-neutral-600">
                            Drag the player window to a second monitor, then fullscreen in the browser/OS.
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {showContracts && hasDocuSignRows ? (
        <section id="portal-contracts" className="scroll-mt-6 mt-10">
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
                    Signed PDFs and final packets live in DocuSign — use DocuSigned email receipts or your DocuSign account
                    &ldquo;Completed&rdquo; folder to download copies. This portal does not store contract files.
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
        <section id="portal-invoices" className="scroll-mt-6 mt-10">
          <h2 className="text-sm font-medium text-neutral-200">Invoices &amp; payments</h2>
          <p className="mt-1 text-xs text-neutral-500">
            ULS sends Stripe-hosted invoices when billing is finalized. Pay from the button below once a link appears — no
            account required on this portal.
          </p>
          {stripeSandbox ? (
            <p className="mt-3 rounded border border-sky-900/55 bg-sky-950/30 px-3 py-2 text-[11px] leading-relaxed text-sky-100">
              <span className="font-semibold">Test invoices:</span> Use Stripe&apos;s{" "}
              <span className="font-medium">4242&nbsp;4242&nbsp;4242&nbsp;4242</span> card numbers or other test methods. Nothing
              here moves real money until ULS switches to live Stripe keys.
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
              const rawHosted = inv.hostedInvoiceUrl?.trim() ?? "";
              const hostedHttps = rawHosted ? parseHttpsUrl(rawHosted) : null;
              const hostedUrlRejected = Boolean(rawHosted && !hostedHttps);
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
                      <span className="font-semibold text-rose-100/95">Stripe notice:</span> {inv.lastStripeErrorSummary}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    {hostedHttps && (inv.status === "open" || inv.status === "draft") ? (
                      <a
                        href={hostedHttps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-center text-sm font-medium text-black hover:bg-amber-500"
                      >
                        View or pay invoice
                      </a>
                    ) : null}
                    {hostedHttps && inv.status === "paid" ? (
                      <a
                        href={hostedHttps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg border border-neutral-600 px-4 py-2 text-center text-sm font-medium text-neutral-100 hover:bg-neutral-900"
                      >
                        Invoice &amp; receipt
                      </a>
                    ) : null}
                    {hostedUrlRejected && (inv.status === "open" || inv.status === "draft" || inv.status === "paid") ? (
                      <p className="text-xs text-rose-200/90">
                        Hosted invoice link on file is not a valid <span className="font-mono text-[10px]">https</span> URL —
                        ask your producer to resync from Stripe.
                      </p>
                    ) : null}
                    {!rawHosted && inv.status === "open" ? (
                      <p className="text-xs text-amber-200/90">
                        Your pay link isn&apos;t synced yet — refresh shortly or email your ULS producer if this persists.
                      </p>
                    ) : null}
                    {inv.status === "paid" && !rawHosted ? (
                      <p className="text-xs text-neutral-500">Thank you — this invoice is settled in Stripe.</p>
                    ) : null}
                    {inv.status === "draft" && !rawHosted ? (
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

      {showShowDay ? (
        <section id="portal-show-day" className="scroll-mt-6 mt-10">
          <h2 className="text-sm font-medium text-neutral-200">Show day</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Flag-it style notes from ULS — <span className="text-neutral-400">informational only, no performance SLA</span>.
            Use your official call sheet and venue contacts for operational authority.
          </p>
          {!hasShowDayFlags ? (
            <p className="mt-4 text-sm text-neutral-500">
              No flags posted yet — your producer will share brief updates here as the schedule firms up.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {project.showDayFlags.map((f) => (
                <li
                  key={f.id}
                  className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-3 text-sm text-neutral-200"
                >
                  <p className="text-[10px] text-neutral-500">{f.createdAt.toLocaleString()}</p>
                  <p className="mt-2 whitespace-pre-wrap">{f.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showVault ? (
        <section id="portal-post-event" className="scroll-mt-6 mt-10">
          <h2 className="text-sm font-medium text-neutral-200">Post-event delivery</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Photo gallery (SmugMug / Pageant Expressions) and livestream/replay (Castr) stay on those vendors — the portal only
            stores outbound links; usage follows each platform and your contract.
          </p>
          {vaultUrlRejected ? (
            <p className="mt-4 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-100">
              A stored link could not be shown (not a valid <span className="font-mono text-[11px]">https</span> URL). Ask your
              ULS producer to fix the gallery or Castr field in the producer inbox.
            </p>
          ) : null}
          {!hasVaultLinks && !vaultUrlRejected ? (
            <p className="mt-4 text-sm text-neutral-500">
              Your producer will add gallery and livestream pointers here when they&apos;re ready to hand off.
            </p>
          ) : null}
          {hasVaultLinks ? (
            <ul className="mt-4 space-y-3">
              {smugSafe ? (
                <li className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Photo gallery (SmugMug / Pageant)</p>
                  <a
                    href={smugSafe}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block break-all text-amber-400 hover:text-amber-300"
                  >
                    {smugSafe}
                  </a>
                </li>
              ) : null}
              {castrSafe ? (
                <li className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Castr</p>
                  <a
                    href={castrSafe}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block break-all text-amber-400 hover:text-amber-300"
                  >
                    {castrSafe}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

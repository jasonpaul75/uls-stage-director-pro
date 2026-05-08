import { resendDirectorInvite, sendDirectorInvite } from "@/app/producer/inbox/invite-actions";
import { Button } from "@/components/ui";
import { producerIntakeFieldClass } from "@/lib/producer-intake-ui";

import { ProducerIntakeCollapsible } from "./producer-intake-collapsible";
import { ProducerIntakeSectionShell } from "./producer-intake-section-shell";

export type ProducerIntakeOutstandingInviteRow = {
  email: string;
  expiresAt: Date;
  stale: boolean;
};

export function ProducerIntakeDirectorInviteSection(props: {
  projectId: string;
  activeInviteRows: ProducerIntakeOutstandingInviteRow[];
}) {
  const { projectId, activeInviteRows } = props;

  return (
    <ProducerIntakeSectionShell
      id="director-invite"
      title="Director invite"
      description={
        <>
          <p>Send one email invite per director. They create a portal password (or attach to their current director login).</p>
          <ProducerIntakeCollapsible title="Email delivery (SES)" defaultOpen={false}>
            <p className="text-[11px] leading-relaxed text-uls-subtle">
              Uses the same Amazon SES sender as intake notifications — verify recipients in the SES sandbox until production is
              lifted.
            </p>
          </ProducerIntakeCollapsible>
        </>
      }
    >
      <form action={sendDirectorInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="projectId" value={projectId} />
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-uls-muted">Director email</span>
          <input
            type="email"
            name="directorEmail"
            required
            autoComplete="off"
            placeholder="director@email.com"
            className={producerIntakeFieldClass}
          />
        </label>
        <Button type="submit" variant="primary" size="sm">
          Send invite
        </Button>
      </form>

      {activeInviteRows.length > 0 ? (
        <div className="space-y-3 pt-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-uls-subtle">Outstanding invites</h3>
          <ul className="space-y-2 text-sm">
            {activeInviteRows.map((row, i) => (
              <li
                key={`${row.email}-${row.expiresAt.toISOString()}-${i}`}
                className="flex flex-col gap-2 rounded-uls-card border border-uls-border bg-uls-surface/45 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-uls-text">{row.email}</p>
                  <p className="text-xs text-uls-subtle">
                    Expires UTC {row.expiresAt.toISOString().replace("T", " ").slice(0, 16)}
                    {row.stale ? " · expired until resent" : ""}
                  </p>
                </div>
                <form action={resendDirectorInvite} className="shrink-0">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="directorEmail" value={row.email} />
                  <Button type="submit" variant="secondary" size="sm" className="border-amber-900/65 text-amber-200 hover:bg-amber-950/40">
                    Resend
                  </Button>
                </form>
              </li>
            ))}
          </ul>
          <p className="text-xs text-uls-subtle">
            Resend clears any unused invite tokens for that address on this production, then sends a fresh link (same one-week
            window).
          </p>
        </div>
      ) : null}
    </ProducerIntakeSectionShell>
  );
}

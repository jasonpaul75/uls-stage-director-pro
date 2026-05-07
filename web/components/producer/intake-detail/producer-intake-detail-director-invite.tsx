import { resendDirectorInvite, sendDirectorInvite } from "@/app/producer/inbox/invite-actions";

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
    <section id="director-invite" className="scroll-mt-6 mt-10">
      <h2 className="text-sm font-medium text-zinc-200">Director invite</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Send one email invite per director. They create a portal password (or attach to their current director login). Uses
        the same Amazon SES sender as intake notifications — verify recipients in the SES sandbox until production is lifted.
      </p>
      <form action={sendDirectorInvite} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="projectId" value={projectId} />
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-zinc-400">Director email</span>
          <input
            type="email"
            name="directorEmail"
            required
            autoComplete="off"
            placeholder="director@email.com"
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          Send invite
        </button>
      </form>

      {activeInviteRows.length > 0 ? (
        <div className="mt-8 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Outstanding invites</h3>
          <ul className="space-y-2 text-sm">
            {activeInviteRows.map((row, i) => (
              <li
                key={`${row.email}-${row.expiresAt.toISOString()}-${i}`}
                className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">{row.email}</p>
                  <p className="text-xs text-zinc-500">
                    Expires UTC {row.expiresAt.toISOString().replace("T", " ").slice(0, 16)}
                    {row.stale ? " · expired until resent" : ""}
                  </p>
                </div>
                <form action={resendDirectorInvite} className="shrink-0">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="directorEmail" value={row.email} />
                  <button
                    type="submit"
                    className="rounded border border-amber-900/70 bg-transparent px-3 py-1.5 text-xs font-medium text-amber-500 hover:bg-amber-950/40"
                  >
                    Resend
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-600">
            Resend clears any unused invite tokens for that address on this production, then sends a fresh link (same
            one-week window).
          </p>
        </div>
      ) : null}
    </section>
  );
}

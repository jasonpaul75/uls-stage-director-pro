import Link from "next/link";

import { portalSignOutAction } from "@/app/portal/sign-out-action";
import { buttonClassName } from "@/components/ui";
import { cn } from "@/lib/cn";
import { GlobalRole } from "@prisma/client";

const adminStripLink =
  "inline-flex min-h-11 touch-manipulation items-center rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-uls-muted transition-colors hover:bg-white/[0.06] hover:text-uls-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uls-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-uls-canvas sm:min-h-9 sm:px-2";

function initialsFromEmail(email: string): string {
  const e = email.trim();
  if (!e) return "?";
  const local = e.split("@")[0]?.trim() || e;
  const parts = local.split(/[.\-+_]/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]![0] ?? "?") + (parts[1]![0] ?? "?")).toUpperCase();
  return local.slice(0, 2).toUpperCase() || "?";
}

export function PortalUserCluster({ email, role }: { email: string; role: GlobalRole }) {
  const initials = initialsFromEmail(email);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
      <button
        type="button"
        aria-label="Notifications (coming soon)"
        disabled
        aria-disabled="true"
        className={cn(
          "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-uls-muted backdrop-blur-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-uls-canvas",
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
      </button>

      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-gradient-to-br from-amber-400/35 to-violet-500/25 text-xs font-semibold text-uls-text shadow-[inset_0_1px_0_0_rgb(255_255_255/0.12)] backdrop-blur-sm"
        title={email || undefined}
        aria-label={email ? `Account: ${email}` : "Account"}
      >
        <span aria-hidden>{initials}</span>
      </div>

      {role === GlobalRole.ULS_ADMIN ? (
        <div className="flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-uls-surface/30 p-0.5 backdrop-blur-sm">
          <Link href="/producer" className={adminStripLink}>
            Production
          </Link>
        </div>
      ) : null}

      <form action={portalSignOutAction}>
        <button
          type="submit"
          aria-label="Sign out of Director portal"
          className={buttonClassName(
            "secondary",
            "sm",
            "rounded-full border-white/[0.12] bg-white/[0.05] text-uls-text hover:bg-white/[0.1]",
          )}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

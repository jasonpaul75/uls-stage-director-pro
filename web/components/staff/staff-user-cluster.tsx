import Link from "next/link";

import { ClientAfterHydration } from "@/components/client-after-hydration";
import { buttonClassName } from "@/components/ui";
import { staffSignOutAction } from "@/app/staff/sign-out-action";
import { cn } from "@/lib/cn";

function initialsFromEmail(email: string): string {
  const e = email.trim();
  if (!e) return "?";
  const local = e.split("@")[0]?.trim() || e;
  const parts = local.split(/[.\-+_]/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]![0] ?? "?") + (parts[1]![0] ?? "?")).toUpperCase();
  return local.slice(0, 2).toUpperCase() || "?";
}

export function StaffUserCluster({ email }: { email: string }) {
  const initials = initialsFromEmail(email);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-gradient-to-br from-sky-400/35 to-emerald-500/25 text-xs font-semibold text-uls-text shadow-[inset_0_1px_0_0_rgb(255_255_255/0.12)] backdrop-blur-sm"
        title={email || undefined}
        aria-label={email ? `Account: ${email}` : "Account"}
      >
        <span aria-hidden>{initials}</span>
      </div>

      <ClientAfterHydration
        fallback={
          <div
            className={cn(
              buttonClassName(
                "secondary",
                "sm",
                "rounded-full border-transparent bg-transparent px-5 text-transparent select-none opacity-0",
              ),
            )}
            aria-hidden
          >
            Sign out
          </div>
        }
      >
        <form action={staffSignOutAction} autoComplete="off">
          <button
            type="submit"
            aria-label="Sign out of crew workspace"
            className={buttonClassName(
              "secondary",
              "sm",
              "rounded-full border-white/[0.12] bg-white/[0.05] text-uls-text hover:bg-white/[0.1]",
            )}
          >
            Sign out
          </button>
        </form>
      </ClientAfterHydration>
    </div>
  );
}

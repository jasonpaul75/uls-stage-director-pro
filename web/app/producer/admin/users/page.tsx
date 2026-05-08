import Link from "next/link";
import { redirect } from "next/navigation";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";

import { createStaffUser, setStaffUserDisabled } from "./actions";

import { AppShell, Button, buttonClassName } from "@/components/ui";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole } from "@prisma/client";

type Props = { searchParams?: Promise<Record<string, string | undefined>> };

const inputClass =
  "rounded-md border border-uls-border-strong bg-uls-surface-inset px-3 py-2 text-sm text-uls-text placeholder:text-uls-subtle";

export default async function ProducerAdminUsersPage(props: Props) {
  const session = await auth();
  const role = session?.user?.globalRole;
  if (!session?.user?.id || role !== GlobalRole.ULS_ADMIN) {
    redirect("/producer");
  }

  const sp = (await props.searchParams) ?? {};

  const staff = await prisma.user.findMany({
    where: { globalRole: { in: [GlobalRole.PRODUCER, GlobalRole.ULS_ADMIN] } },
    select: {
      id: true,
      email: true,
      name: true,
      globalRole: true,
      disabledAt: true,
      createdAt: true,
    },
    orderBy: { email: "asc" },
  });

  const errFlash =
    sp.err === "bad_email"
      ? "Enter a valid email."
      : sp.err === "weak_password"
        ? "Password must be at least 12 characters."
        : sp.err === "bad_role"
          ? "Pick producer or admin role."
          : sp.err === "duplicate"
            ? "That email is already registered."
            : sp.err === "self"
              ? "You cannot change your own account from this row — use password reset flows."
              : sp.err === "missing"
                ? "User not found."
                : sp.err === "bad_request"
                  ? "Bad request."
                  : null;

  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Admin</p>
          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">Production staff accounts</h1>
          <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
            Invite-only internal users (ULS admin). Disabling a row blocks password sign-in; directors are managed through intake
            invites, not here.
          </p>
        </header>
        <Link href="/producer" className={buttonClassName("ghost", "sm")}>
          ← Command center
        </Link>
      </div>

      {sp.created === "1" ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-emerald-500/25 bg-emerald-950/25">
          <p role="status" className="text-sm text-emerald-100">
            Staff user created — share credentials through your secure channel and have them change password after first sign-in.
          </p>
        </ProducerGlassCard>
      ) : null}
      {sp.saved === "1" ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-emerald-500/25 bg-emerald-950/25">
          <p role="status" className="text-sm text-emerald-100">Account status updated.</p>
        </ProducerGlassCard>
      ) : null}
      {errFlash ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-rose-500/25 bg-rose-950/25">
          <p role="alert" className="text-sm text-rose-100">{errFlash}</p>
        </ProducerGlassCard>
      ) : null}

      <ProducerGlassCard className="mt-10 max-w-xl">
        <h2 className="text-sm font-medium text-uls-text">Add producer or ULS admin</h2>
        <form action={createStaffUser} className="mt-4 flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-uls-muted">Email</span>
            <input type="email" name="email" required autoComplete="off" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-uls-muted">Display name (optional)</span>
            <input type="text" name="name" autoComplete="off" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-uls-muted">Temporary password (min 12 chars)</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              minLength={12}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-uls-muted">Role</span>
            <select name="globalRole" required className={inputClass}>
              <option value="PRODUCER">Producer</option>
              <option value="ULS_ADMIN">ULS admin</option>
            </select>
          </label>
          <Button type="submit" variant="primary" size="sm" className="w-fit">
            Create account
          </Button>
        </form>
      </ProducerGlassCard>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-uls-text">Existing staff ({staff.length})</h2>
        <ul className="mt-4 list-none space-y-3 pl-0">
          {staff.map((u) => (
            <li key={u.id} className="list-none">
              <ProducerGlassCard as="div" padding="compact" className="transition-[border-color] hover:border-white/[0.12]">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-uls-muted">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-uls-text">{u.email}</p>
                    <p className="text-uls-subtle">
                      {(u.name ?? "").trim() || "—"} · {u.globalRole}
                      {u.disabledAt ? " · disabled (sign-in blocked)" : ""}
                    </p>
                  </div>
                  {u.id === session.user.id ? (
                    <span className="text-[10px] text-uls-subtle">you</span>
                  ) : (
                    <div className="flex gap-2">
                      {u.disabledAt ? (
                        <form action={setStaffUserDisabled}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="disabled" value="0" />
                          <button
                            type="submit"
                            className="rounded-md border border-emerald-900/70 bg-emerald-950/40 px-2 py-1 text-[11px] text-emerald-200 transition hover:bg-emerald-950/65"
                          >
                            Re-enable sign-in
                          </button>
                        </form>
                      ) : (
                        <form action={setStaffUserDisabled}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="disabled" value="1" />
                          <button
                            type="submit"
                            className="rounded-md border border-rose-900/60 bg-rose-950/35 px-2 py-1 text-[11px] text-rose-100 transition hover:bg-rose-950/55"
                          >
                            Disable sign-in
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </ProducerGlassCard>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

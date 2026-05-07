import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole } from "@prisma/client";

import { createStaffUser, setStaffUserDisabled } from "./actions";

type Props = { searchParams?: Promise<Record<string, string | undefined>> };

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
    <main id="producer-main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <nav className="text-sm text-zinc-500">
        <Link href="/producer" className="text-amber-500 hover:text-amber-400">
          ← Production home
        </Link>
      </nav>
      <p className="mt-6 text-sm uppercase tracking-widest text-amber-500">Admin</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Production staff accounts</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Invite-only internal users (ULS admin). Disabling a row blocks password sign-in; directors are managed through
        intake invites, not here.
      </p>

      {sp.created === "1" ? (
        <p className="mt-4 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Staff user created — share credentials through your secure channel and have them change password after first
          sign-in.
        </p>
      ) : null}
      {sp.saved === "1" ? (
        <p className="mt-4 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Account status updated.
        </p>
      ) : null}
      {errFlash ? <p className="mt-4 text-sm text-red-400">{errFlash}</p> : null}

      <section className="mt-10 max-w-xl rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-medium text-zinc-200">Add producer or ULS admin</h2>
        <form action={createStaffUser} className="mt-4 flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="off"
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Display name (optional)</span>
            <input
              type="text"
              name="name"
              autoComplete="off"
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Temporary password (min 12 chars)</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              minLength={12}
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Role</span>
            <select name="globalRole" required className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100">
              <option value="PRODUCER">Producer</option>
              <option value="ULS_ADMIN">ULS admin</option>
            </select>
          </label>
          <button
            type="submit"
            className="w-fit rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
          >
            Create account
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-200">Existing staff ({staff.length})</h2>
        <ul className="mt-3 space-y-2 text-xs text-zinc-300">
          {staff.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{u.email}</p>
                <p className="text-zinc-500">
                  {(u.name ?? "").trim() || "—"} · {u.globalRole}
                  {u.disabledAt ? " · disabled (sign-in blocked)" : ""}
                </p>
              </div>
              {u.id === session.user.id ? (
                <span className="text-[10px] text-zinc-600">you</span>
              ) : (
                <div className="flex gap-2">
                  {u.disabledAt ? (
                    <form action={setStaffUserDisabled}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="disabled" value="0" />
                      <button
                        type="submit"
                        className="rounded border border-emerald-900/70 bg-emerald-950/40 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-950/65"
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
                        className="rounded border border-rose-900/60 bg-rose-950/35 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-950/55"
                      >
                        Disable sign-in
                      </button>
                    </form>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

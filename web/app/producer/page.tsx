import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProjectStatus } from "@prisma/client";

export default async function ProducerHome() {
  const session = await auth();
  const intakeCount = await prisma.project.count({
    where: { status: ProjectStatus.INTAKE_SUBMITTED },
  });

  return (
    <main className="mx-auto max-w-lg p-8">
      <p className="text-sm uppercase tracking-widest text-amber-500">Production</p>
      <h1 className="mt-2 text-2xl font-semibold">Command center</h1>
      <p className="mt-4 text-neutral-400">
        {session?.user?.email} · <span className="text-neutral-200">{session?.user?.globalRole}</span>
      </p>

      <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-200">Director intake inbox</p>
            <p className="text-xs text-zinc-500">{intakeCount} open submission(s)</p>
          </div>
          <Link
            href="/producer/inbox"
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-500"
          >
            Open inbox
          </Link>
        </div>
      </section>

      <p className="mt-8 text-sm text-neutral-500">RoS builder and show-day tools ship here.</p>
    </main>
  );
}

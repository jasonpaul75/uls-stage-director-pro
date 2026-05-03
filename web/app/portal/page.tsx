import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProjectRole } from "@prisma/client";

type Props = { searchParams?: Promise<{ submitted?: string }> };

export default async function PortalHome(props: Props) {
  const session = await auth();
  const sp = (await props.searchParams) ?? {};

  const rows = session?.user?.id
    ? await prisma.projectMember.findMany({
        where: { userId: session.user.id, role: ProjectRole.DIRECTOR },
        include: { project: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className="mx-auto max-w-lg p-8">
      <p className="text-sm uppercase tracking-widest text-amber-500">Director portal</p>
      <h1 className="mt-2 text-2xl font-semibold">ULS Stage Director PRO</h1>
      <p className="mt-4 text-neutral-400">
        Signed in as{" "}
        <span className="text-neutral-200">{session?.user?.email ?? "unknown"}</span>
      </p>

      {sp.submitted === "1" ? (
        <p className="mt-4 rounded border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          Intake submitted. ULS production will reach out — you can watch this project below as it progresses.
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-4">
        <Link
          href="/portal/intake/new"
          className="rounded-lg border border-amber-700 bg-amber-600/90 px-4 py-3 text-center text-sm font-medium text-black hover:bg-amber-500"
        >
          Start intake request
        </Link>

        <div>
          <h2 className="text-sm font-medium text-neutral-300">Your productions</h2>
          {rows.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No projects yet — start an intake above.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {rows.map(({ project }) => (
                <li
                  key={project.id}
                  className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-neutral-100">
                    <Link href={`/portal/projects/${project.id}`} className="text-amber-400 hover:text-amber-300">
                      {project.name}
                    </Link>
                  </p>
                  <p className="text-neutral-500">
                    Status:{" "}
                    <span className="text-neutral-400">
                      {project.status === "INTAKE_SUBMITTED" ? "Queued for ULS" : project.status}
                    </span>
                  </p>
                  {project.venue ? (
                    <p className="text-neutral-500">
                      Venue:{" "}
                      <span className="text-neutral-400">
                        {project.venue}
                        {project.cityState ? ` · ${project.cityState}` : ""}
                      </span>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-10 text-xs text-neutral-600">Run-of-show and event tools will attach to each production here.</p>
    </main>
  );
}

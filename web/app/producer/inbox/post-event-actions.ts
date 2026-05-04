"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectStatus } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

/** Accept https URLs only; blank → null. */
function normalizeHttpsUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.length > 2048) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function savePostEventVaultPointers(formData: FormData) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) redirect("/producer/inbox");

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!project) redirect("/producer/inbox");

  const smug = normalizeHttpsUrl(String(formData.get("postEventSmugMugUrl") ?? ""));
  const pageant = normalizeHttpsUrl(String(formData.get("postEventPageantExpressionsUrl") ?? ""));
  const castr = normalizeHttpsUrl(String(formData.get("postEventCastrUrl") ?? ""));
  const rawSmug = String(formData.get("postEventSmugMugUrl") ?? "").trim();
  const rawPageant = String(formData.get("postEventPageantExpressionsUrl") ?? "").trim();
  const rawCastr = String(formData.get("postEventCastrUrl") ?? "").trim();

  if ((rawSmug && !smug) || (rawPageant && !pageant) || (rawCastr && !castr)) {
    redirect(`/producer/inbox/${projectId}?post_event_err=bad_url`);
  }

  const postEventVaultDirectorVisible = formData.get("postEventVaultDirectorVisible") === "on";

  await prisma.project.update({
    where: { id: projectId },
    data: {
      postEventSmugMugUrl: smug,
      postEventPageantExpressionsUrl: pageant,
      postEventCastrUrl: castr,
      postEventVaultDirectorVisible,
    },
  });

  revalidatePath(`/producer/inbox/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  redirect(`/producer/inbox/${projectId}?post_event_saved=1`);
}

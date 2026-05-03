"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { notifyIntakeSubmitted } from "@/lib/email/send-intake-notification";
import { prisma } from "@/lib/prisma";
import { ProjectRole, ProjectStatus } from "@prisma/client";

function makeIntakeSlug(): string {
  const n = randomBytes(8).toString("hex");
  return `intake-${n}`;
}

function optionalInt(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function optionalDate(value: FormDataEntryValue | null): Date | undefined {
  if (value === null || value === "") return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Director submits a new production intake (goes to internal queue). */
export async function submitIntakeRequest(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.globalRole;
  const canSubmitIntake = role === "DIRECTOR" || role === "ULS_ADMIN";
  if (!userId || !canSubmitIntake) {
    redirect("/login?callbackUrl=/portal/intake/new");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/portal/intake/new?error=missing_name");
  }

  const venue = String(formData.get("venue") ?? "").trim() || undefined;
  const cityState = String(formData.get("cityState") ?? "").trim() || undefined;
  const categoryNotes = String(formData.get("categoryNotes") ?? "").trim() || undefined;
  const livestreamNotes = String(formData.get("livestreamNotes") ?? "").trim() || undefined;
  const budgetNotes = String(formData.get("budgetNotes") ?? "").trim() || undefined;
  const additionalNotes = String(formData.get("additionalNotes") ?? "").trim() || undefined;
  const requestedEventStart = optionalDate(formData.get("requestedEventStart"));
  const requestedEventEnd = optionalDate(formData.get("requestedEventEnd"));
  const contestantApprox = optionalInt(formData.get("contestantApprox"));

  const submittedAt = new Date();

  let createdId = "";

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name,
        slug: makeIntakeSlug(),
        status: ProjectStatus.INTAKE_SUBMITTED,
        venue,
        cityState,
        requestedEventStart,
        requestedEventEnd,
        categoryNotes,
        contestantApprox,
        livestreamNotes,
        budgetNotes,
        additionalNotes,
        submittedAt,
      },
    });

    createdId = project.id;

    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId,
        role: ProjectRole.DIRECTOR,
      },
    });
  });

  const fuller = await prisma.project.findUnique({
    where: { id: createdId },
    include: {
      memberships: {
        where: { role: ProjectRole.DIRECTOR },
        include: { user: { select: { email: true } } },
      },
    },
  });

  if (fuller) {
    const directorEmails = fuller.memberships.map((m) => m.user.email);
    await notifyIntakeSubmitted({
      projectId: fuller.id,
      projectName: fuller.name,
      slug: fuller.slug,
      directorEmails,
      venue: fuller.venue,
      cityState: fuller.cityState,
      contestantApprox: fuller.contestantApprox,
      additionalNotes: fuller.additionalNotes,
      submittedAt: fuller.submittedAt ?? submittedAt,
    });
  }

  revalidatePath("/portal");
  revalidatePath("/producer");
  revalidatePath("/producer/inbox");
  redirect("/portal?submitted=1");
}

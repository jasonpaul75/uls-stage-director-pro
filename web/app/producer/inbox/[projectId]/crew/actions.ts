"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectStatus } from "@prisma/client";

async function requireProducerSession() {
  const session = await auth();
  const role = session?.user?.globalRole;
  if (!session?.user?.id || (role !== GlobalRole.PRODUCER && role !== GlobalRole.ULS_ADMIN)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }
  return { userId: session.user.id };
}

async function assertSubmittedIntake(projectId: string): Promise<void> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!row) redirect("/producer/inbox");
}

export async function assignCrewMember(formData: FormData) {
  const { userId } = await requireProducerSession();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const staffUserId = String(formData.get("staffUserId") ?? "").trim();
  await assertSubmittedIntake(projectId);

  if (!staffUserId) redirect(`/producer/inbox/${projectId}/crew?crew_err=no_staff`);

  const staffOk = await prisma.user.findFirst({
    where: { id: staffUserId, globalRole: GlobalRole.STAFF, disabledAt: null },
    select: { id: true },
  });
  if (!staffOk) redirect(`/producer/inbox/${projectId}/crew?crew_err=bad_staff`);

  await prisma.projectStaffAssignment.upsert({
    where: { projectId_staffUserId: { projectId, staffUserId } },
    create: { projectId, staffUserId, assignedByUserId: userId },
    update: { assignedByUserId: userId },
  });

  revalidatePath(`/producer/inbox/${projectId}/crew`);
  revalidatePath("/producer/inbox");
  revalidatePath("/producer/calendar");
  revalidatePath("/producer");
  revalidatePath("/staff");
  redirect(`/producer/inbox/${projectId}/crew?crew_saved=1`);
}

export async function removeCrewAssignment(formData: FormData) {
  await requireProducerSession();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  await assertSubmittedIntake(projectId);

  const row = await prisma.projectStaffAssignment.findFirst({
    where: { id: assignmentId, projectId },
    select: { id: true, projectId: true, staffUserId: true },
  });
  if (!row) redirect(`/producer/inbox/${projectId}/crew?crew_err=missing`);

  await prisma.$transaction([
    prisma.staffEventQuestionnaire.deleteMany({
      where: { projectId: row.projectId, staffUserId: row.staffUserId },
    }),
    prisma.projectStaffAssignment.delete({ where: { id: assignmentId } }),
  ]);

  revalidatePath(`/producer/inbox/${projectId}/crew`);
  revalidatePath("/producer/inbox");
  revalidatePath("/producer/calendar");
  revalidatePath("/producer");
  revalidatePath("/staff");
  redirect(`/producer/inbox/${projectId}/crew?crew_saved=1`);
}

export async function updateCrewDuties(formData: FormData) {
  await requireProducerSession();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const duties = String(formData.get("duties") ?? "").trim().slice(0, 8000);
  await assertSubmittedIntake(projectId);

  const row = await prisma.projectStaffAssignment.findFirst({
    where: { id: assignmentId, projectId },
    select: { id: true },
  });
  if (!row) redirect(`/producer/inbox/${projectId}/crew?crew_err=missing`);

  await prisma.projectStaffAssignment.update({
    where: { id: assignmentId },
    data: { duties: duties.length > 0 ? duties : null },
  });

  revalidatePath(`/producer/inbox/${projectId}/crew`);
  revalidatePath("/staff");
  redirect(`/producer/inbox/${projectId}/crew?crew_saved=1`);
}

export async function prepareCrewQuestionnaires(formData: FormData) {
  await requireProducerSession();
  const projectId = String(formData.get("projectId") ?? "").trim();
  await assertSubmittedIntake(projectId);

  const assigns = await prisma.projectStaffAssignment.findMany({
    where: { projectId },
    select: { staffUserId: true },
  });
  if (assigns.length === 0) redirect(`/producer/inbox/${projectId}/crew?crew_err=no_assign`);

  await prisma.staffEventQuestionnaire.createMany({
    data: assigns.map((a) => ({
      projectId,
      staffUserId: a.staffUserId,
    })),
    skipDuplicates: true,
  });

  revalidatePath(`/producer/inbox/${projectId}/crew`);
  revalidatePath("/producer/inbox");
  revalidatePath("/producer/calendar");
  revalidatePath("/producer");
  revalidatePath("/staff");
  redirect(`/producer/inbox/${projectId}/crew?crew_saved=1`);
}

export async function addProjectExpenseLine(formData: FormData) {
  await requireProducerSession();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim().slice(0, 240);
  const category = String(formData.get("category") ?? "").trim().slice(0, 80);
  const dollarsRaw = String(formData.get("amountUsd") ?? "").trim();
  await assertSubmittedIntake(projectId);

  if (!label || !category) redirect(`/producer/inbox/${projectId}/crew?crew_err=exp_bad`);

  const dollars = Number.parseFloat(dollarsRaw);
  if (!Number.isFinite(dollars)) redirect(`/producer/inbox/${projectId}/crew?crew_err=exp_bad`);

  const amountCents = Math.round(dollars * 100);

  await prisma.projectExpenseLine.create({
    data: { projectId, label, category, amountCents },
  });

  revalidatePath(`/producer/inbox/${projectId}/crew`);
  redirect(`/producer/inbox/${projectId}/crew?crew_saved=1`);
}

export async function deleteProjectExpenseLine(formData: FormData) {
  await requireProducerSession();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const expenseId = String(formData.get("expenseId") ?? "").trim();
  await assertSubmittedIntake(projectId);

  const row = await prisma.projectExpenseLine.findFirst({
    where: { id: expenseId, projectId },
    select: { id: true },
  });
  if (!row) redirect(`/producer/inbox/${projectId}/crew?crew_err=missing`);

  await prisma.projectExpenseLine.delete({ where: { id: expenseId } });

  revalidatePath(`/producer/inbox/${projectId}/crew`);
  redirect(`/producer/inbox/${projectId}/crew?crew_saved=1`);
}

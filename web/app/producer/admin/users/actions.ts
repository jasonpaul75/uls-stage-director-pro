"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateProjectMirrorCache, revalidateProducerOverview } from "@/lib/revalidate-project-mirror-cache";
import { GlobalRole } from "@prisma/client";
import { hashSync } from "bcryptjs";

function requireAdminSession() {
  return auth().then((s) => {
    const role = s?.user?.globalRole as GlobalRole | undefined;
    if (!s?.user?.id || role !== GlobalRole.ULS_ADMIN) {
      redirect("/producer");
    }
    return { id: s.user.id, role };
  });
}

export async function createStaffUser(formData: FormData) {
  await requireAdminSession();

  const emailRaw = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 120);
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("globalRole") ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    redirect("/producer/admin/users?err=bad_email");
  }
  if (password.length < 12) {
    redirect("/producer/admin/users?err=weak_password");
  }

  let globalRole: GlobalRole;
  if (roleRaw === "ULS_ADMIN") globalRole = GlobalRole.ULS_ADMIN;
  else if (roleRaw === "PRODUCER") globalRole = GlobalRole.PRODUCER;
  else if (roleRaw === "STAFF") globalRole = GlobalRole.STAFF;
  else {
    redirect("/producer/admin/users?err=bad_role");
  }

  const passwordHash = hashSync(password, 12);

  try {
    await prisma.user.create({
      data: {
        email: emailRaw,
        name: name || null,
        passwordHash,
        globalRole,
      },
    });
  } catch {
    redirect("/producer/admin/users?err=duplicate");
  }

  redirect("/producer/admin/users?created=1");
}

export async function setStaffUserDisabled(formData: FormData) {
  const session = await requireAdminSession();

  const userId = String(formData.get("userId") ?? "").trim();
  const disabledRaw = String(formData.get("disabled") ?? "").trim();

  if (!userId) {
    redirect("/producer/admin/users?err=bad_request");
  }
  if (userId === session.id) {
    redirect("/producer/admin/users?err=self");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) {
    redirect("/producer/admin/users?err=missing");
  }

  const disable = disabledRaw === "1";

  if (disable) {
    const reassigned = await prisma.project.findMany({
      where: { assignedToUserId: userId },
      select: { id: true },
    });

    const crewProjects = await prisma.projectStaffAssignment.findMany({
      where: { staffUserId: userId },
      select: { projectId: true },
    });

    await prisma.$transaction([
      prisma.staffEventQuestionnaire.deleteMany({ where: { staffUserId: userId } }),
      prisma.projectStaffAssignment.deleteMany({ where: { staffUserId: userId } }),
      prisma.staffAvailabilityDay.deleteMany({ where: { userId } }),
      prisma.project.updateMany({
        where: { assignedToUserId: userId },
        data: { assignedToUserId: null },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { disabledAt: new Date() },
      }),
    ]);

    revalidateProducerOverview();
    revalidatePath("/staff");
    for (const p of reassigned) {
      revalidateProjectMirrorCache(p.id);
    }
    for (const row of crewProjects) {
      revalidateProjectMirrorCache(row.projectId);
      revalidatePath(`/producer/inbox/${row.projectId}/crew`);
    }
    redirect("/producer/admin/users?saved=1");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      disabledAt: null,
    },
  });

  redirect("/producer/admin/users?saved=1");
}

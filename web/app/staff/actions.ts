"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  attachmentsBucketConfigured,
  deleteProjectAttachmentObject,
  putProjectAttachmentObject,
} from "@/lib/s3-project-attachments";
import { GlobalRole, ProjectStatus, StaffAvailabilityStatus, StaffTaxDocumentKind } from "@prisma/client";

const MAX_TAX_BYTES = 25 * 1024 * 1024;

const PDF_ONLY = new Set(["application/pdf"]);

async function requireStaffSession() {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || role !== GlobalRole.STAFF) {
    redirect("/login?callbackUrl=%2Fstaff");
  }
  const disabled = await prisma.user.findUnique({
    where: { id: uid },
    select: { disabledAt: true },
  });
  if (disabled?.disabledAt) {
    redirect("/login?callbackUrl=%2Fstaff");
  }
  return { userId: uid };
}

function safeFileBase(name: string): string {
  const base = name.trim().replace(/^.*[/\\]/, "").slice(0, 200);
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, "_");
  return cleaned.length > 0 ? cleaned : "upload.pdf";
}

function parseTaxKind(raw: string): StaffTaxDocumentKind | null {
  if (raw === "W9") return StaffTaxDocumentKind.W9;
  if (raw === "W2") return StaffTaxDocumentKind.W2;
  return null;
}

function parseAvailability(raw: string): StaffAvailabilityStatus | null {
  if (raw === "AVAILABLE") return StaffAvailabilityStatus.AVAILABLE;
  if (raw === "UNAVAILABLE") return StaffAvailabilityStatus.UNAVAILABLE;
  return null;
}

function parseCalendarDate(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export async function upsertStaffAvailability(formData: FormData) {
  const { userId } = await requireStaffSession();

  const dateRaw = String(formData.get("date") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 500);

  const date = parseCalendarDate(dateRaw);
  const status = parseAvailability(statusRaw);
  if (!date || !status) {
    redirect("/staff/availability?avail_err=bad");
  }

  await prisma.staffAvailabilityDay.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, status, note: note.length > 0 ? note : null },
    update: { status, note: note.length > 0 ? note : null },
  });

  const crewAssignments = await prisma.projectStaffAssignment.findMany({
    where: { staffUserId: userId },
    select: { projectId: true },
  });
  for (const row of crewAssignments) {
    revalidatePath(`/producer/inbox/${row.projectId}/crew`);
  }

  revalidatePath("/staff");
  revalidatePath("/staff/availability");
  redirect("/staff/availability?avail_saved=1");
}

export async function uploadStaffTaxDocument(formData: FormData) {
  const { userId } = await requireStaffSession();

  if (!attachmentsBucketConfigured()) {
    redirect("/staff/tax?tax_err=storage");
  }

  const kind = parseTaxKind(String(formData.get("kind") ?? ""));
  const file = formData.get("file");

  if (!kind) {
    redirect("/staff/tax?tax_err=bad_kind");
  }

  if (!(file instanceof File) || file.size <= 0) {
    redirect("/staff/tax?tax_err=empty");
  }

  if (file.size > MAX_TAX_BYTES) {
    redirect("/staff/tax?tax_err=large");
  }

  const contentType = file.type?.trim() || "application/octet-stream";
  if (!PDF_ONLY.has(contentType)) {
    redirect("/staff/tax?tax_err=bad_type");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const slug = safeFileBase(file.name);
  const rand = randomBytes(10).toString("hex");
  const storageKey = `uls-stage-director/staff-tax/${userId}/${rand}-${slug}`;

  try {
    await putProjectAttachmentObject(storageKey, buf, contentType);

    await prisma.staffTaxDocument.create({
      data: {
        userId,
        kind,
        fileName: slug,
        contentType,
        sizeBytes: buf.length,
        storageKey,
      },
    });

    const crewProjects = await prisma.projectStaffAssignment.findMany({
      where: { staffUserId: userId },
      select: { projectId: true },
    });
    const crewProjectIds = [...new Set(crewProjects.map((r) => r.projectId))];
    for (const pid of crewProjectIds) {
      revalidatePath(`/producer/inbox/${pid}/crew`);
    }
    if (crewProjectIds.length > 0) {
      revalidatePath("/producer/inbox");
    }
  } catch {
    try {
      await deleteProjectAttachmentObject(storageKey);
    } catch {
      /* ignore */
    }
    redirect("/staff/tax?tax_err=server");
  }

  revalidatePath("/staff");
  revalidatePath("/staff/tax");
  redirect("/staff/tax?tax_ok=1");
}

export async function saveStaffQuestionnaire(formData: FormData) {
  const { userId } = await requireStaffSession();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const intent = String(formData.get("intent") ?? "").trim();

  if (!projectId) {
    redirect("/staff?q_err=bad");
  }

  const assign = await prisma.projectStaffAssignment.findFirst({
    where: { projectId, staffUserId: userId, project: { status: ProjectStatus.INTAKE_SUBMITTED } },
    select: { id: true },
  });
  if (!assign) {
    redirect("/staff?q_err=forbidden");
  }

  const row = await prisma.staffEventQuestionnaire.findUnique({
    where: { projectId_staffUserId: { projectId, staffUserId: userId } },
    select: { id: true },
  });
  if (!row) {
    redirect(`/staff/events/${projectId}?q_err=missing`);
  }

  const travelNotes = String(formData.get("travelNotes") ?? "").trim().slice(0, 8000);
  const foodNotes = String(formData.get("foodNotes") ?? "").trim().slice(0, 8000);
  const paymentNotes = String(formData.get("paymentNotes") ?? "").trim().slice(0, 8000);
  const otherNotes = String(formData.get("otherNotes") ?? "").trim().slice(0, 8000);

  await prisma.staffEventQuestionnaire.update({
    where: { id: row.id },
    data: {
      travelNotes: travelNotes.length > 0 ? travelNotes : null,
      foodNotes: foodNotes.length > 0 ? foodNotes : null,
      paymentNotes: paymentNotes.length > 0 ? paymentNotes : null,
      otherNotes: otherNotes.length > 0 ? otherNotes : null,
      ...(intent === "submit" ? { submittedAt: new Date() } : {}),
    },
  });

  revalidatePath("/staff");
  revalidatePath(`/staff/events/${projectId}`);
  revalidatePath(`/producer/inbox/${projectId}/crew`);
  revalidatePath("/producer/inbox");
  revalidatePath("/producer/calendar");
  revalidatePath("/producer");
  redirect(`/staff/events/${projectId}?q_saved=1`);
}

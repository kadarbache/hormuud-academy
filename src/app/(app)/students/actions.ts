"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { canActAtBranch } from "@/lib/access";
import {
  deleteStudentPhoto,
  MAX_PHOTO_BYTES,
  photoUploadEnabled,
  uploadStudentPhoto,
} from "@/lib/cloudinary";
import { addMonths, collegeToday, toDbDate } from "@/lib/dates";
import { formatMoney, formatStudentNumber } from "@/lib/format";
import { isBlankEntry, toStoredPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";
import {
  failure,
  invalid,
  isUniqueViolation,
  success,
  type ActionResult,
  type FieldErrors,
} from "@/lib/action-result";
import {
  formObject,
  isoDate,
  money,
  optionalPhone,
  paymentMethod,
  requiredText,
} from "@/lib/validation";
import { registrationFeePayment } from "../finance/payments";
import { canEditStudent } from "./access";
import type { PhoneMatch } from "./types";

const profileSchema = z.object({
  fullName: requiredText("Enter the student's full name.", 120),
  sex: z.enum(["MALE", "FEMALE"], { error: "Pick male or female." }),
  phone: optionalPhone,
  responsiblePhone: optionalPhone,
  registrationDate: isoDate("Pick the registration date.").refine(
    (value) => value <= collegeToday(),
    "The registration date can't be in the future.",
  ),
});

/**
 * Field errors for the profile part of the form. The "at least one phone"
 * rule spans two fields, and zod skips an object-level rule while any field
 * is invalid, so it's checked here to show every problem on the first try.
 */
function profileErrors(
  values: Record<string, string>,
  result: ReturnType<typeof profileSchema.safeParse>,
): FieldErrors {
  const errors: FieldErrors = result.success ? {} : { ...z.flattenError(result.error).fieldErrors };
  // A phone box already holds the 6 it starts at, so "filled in" means digits
  // beyond that, not merely text in the box.
  if (isBlankEntry(values.phone ?? "") && isBlankEntry(values.responsiblePhone ?? "")) {
    errors.phone = [
      ...(errors.phone ?? []),
      "Enter the student's phone or the responsible person's phone.",
    ];
  }
  return errors;
}

function hasErrors(errors: FieldErrors) {
  return Object.values(errors).some((messages) => messages?.length);
}

const skillsSchema = z.object({
  branchSkillIds: z.array(z.string().min(1)).min(1, "Pick at least one skill."),
  startDate: isoDate("Pick the start date."),
});

/** The photo from the form, if one was picked. Returns an error message for a bad file. */
function readPhoto(formData: FormData): { file: File | null; error?: string } {
  const value = formData.get("photo");
  if (!(value instanceof File) || value.size === 0) return { file: null };
  if (!photoUploadEnabled()) return { file: null, error: "Photo upload isn't set up yet." };
  if (!value.type.startsWith("image/")) return { file: null, error: "Pick an image file." };
  if (value.size > MAX_PHOTO_BYTES) return { file: null, error: "The photo must be under 5 MB." };
  return { file: value };
}

type BranchSkillForEnrollment = {
  id: string;
  skillId: string;
  branchId: string;
  durationMonths: number;
  registrationFee: Prisma.Decimal;
  monthlyFee: Prisma.Decimal;
};

/** The registration fee handed over as the student joins, if it was. */
type FeePaidNow = { on: string; method: "CASH" | "ZAAD" | "EDAHAB" | "BANK" } | null;

/**
 * One enrollment, with its registration fee payment attached when the student
 * pays there and then. A skill with no registration fee has nothing to pay,
 * so it gets no payment however the box was ticked.
 */
function enrollmentData(
  studentId: string,
  createdById: string,
  startDate: string,
  bs: BranchSkillForEnrollment,
  paid: FeePaidNow,
) {
  const owed = bs.registrationFee.gt(0);
  return {
    studentId,
    branchSkillId: bs.id,
    skillId: bs.skillId,
    startDate: toDbDate(startDate),
    endDate: toDbDate(addMonths(startDate, bs.durationMonths)),
    // Copied now so a later price change doesn't touch what this student joined at.
    monthlyFee: bs.monthlyFee,
    registrationFee: bs.registrationFee,
    createdById,
    ...(paid && owed
      ? {
          payments: {
            create: [
              registrationFeePayment({
                studentId,
                branchId: bs.branchId,
                amount: bs.registrationFee,
                paidOn: paid.on,
                method: paid.method,
                recordedById: createdById,
              }),
            ],
          },
        }
      : {}),
  };
}

/**
 * How the registration fees on this form were paid, when the box says they
 * were paid now. The method is only asked for once the box is ticked, so an
 * unticked form has nothing to check.
 */
function readFeePaidNow(
  values: Record<string, string>,
  paidOn: string,
): { paid: FeePaidNow; errors: FieldErrors } {
  if (values.registrationFeePaid !== "on") return { paid: null, errors: {} };

  const method = paymentMethod().safeParse(values.registrationFeeMethod);
  if (!method.success) {
    return { paid: null, errors: { registrationFeeMethod: ["Pick how the fee was paid."] } };
  }
  return { paid: { on: paidOn, method: method.data }, errors: {} };
}

export async function registerStudent(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const values = formObject(formData);

  const profile = profileSchema.safeParse(values);
  const skills = skillsSchema.safeParse({
    branchSkillIds: formData.getAll("branchSkillIds"),
    startDate: values.startDate,
  });
  const photo = readPhoto(formData);
  const homeBranchId = user.role === "admin" ? values.homeBranchId : user.branchId;

  // Paid at registration means paid on the registration date. For a student
  // entered from the old system, that's their original date, not today.
  const fee = readFeePaidNow(values, values.registrationDate ?? "");

  // Collect every problem at once so the form shows them all together.
  const fieldErrors: FieldErrors = {
    ...profileErrors(values, profile),
    ...(skills.success ? {} : z.flattenError(skills.error).fieldErrors),
    ...(photo.error ? { photo: [photo.error] } : {}),
    ...(homeBranchId ? {} : { homeBranchId: ["Pick the branch the student registers at."] }),
    ...fee.errors,
  };
  if (!profile.success || !skills.success || !homeBranchId || hasErrors(fieldErrors)) {
    return failure("Check the highlighted fields.", fieldErrors);
  }

  const branch = await prisma.branch.findUnique({ where: { id: homeBranchId } });
  if (!branch?.active) return failure("That branch isn't active. Pick another one.");

  const branchSkillIds = [...new Set(skills.data.branchSkillIds)];
  const branchSkills = await prisma.branchSkill.findMany({
    where: { id: { in: branchSkillIds }, branchId: homeBranchId, active: true, skill: { active: true } },
  });
  if (branchSkills.length !== branchSkillIds.length) {
    return failure("One of the skills is no longer open at this branch. Reload the page and pick again.");
  }

  // Upload first: if it fails, nothing has been saved yet.
  const uploaded = photo.file ? await uploadStudentPhoto(photo.file) : null;

  try {
    const { registrationDate, ...details } = profile.data;
    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          ...details,
          registrationDate: toDbDate(registrationDate),
          homeBranchId,
          createdById: user.id,
          photoUrl: uploaded?.url,
          photoPublicId: uploaded?.publicId,
        },
      });
      // One at a time, not createMany: each enrollment's registration fee
      // payment needs the id of the enrollment it belongs to.
      for (const bs of branchSkills) {
        await tx.enrollment.create({
          data: enrollmentData(
            created.id,
            user.id,
            skills.data.startDate,
            { ...bs, branchId: homeBranchId },
            fee.paid,
          ),
        });
      }
      return created;
    });

    return success(`${student.fullName} registered as ${formatStudentNumber(student.number)}.`, {
      id: student.id,
    });
  } catch (error) {
    if (uploaded) await deleteStudentPhoto(uploaded.publicId).catch(() => {});
    throw error;
  }
}

export async function updateStudent(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return failure("That student no longer exists.");
  if (!canEditStudent(user, student)) {
    return failure("Only staff at the student's home branch can change these details.");
  }

  const values = formObject(formData);
  const profile = profileSchema.safeParse(values);
  const photo = readPhoto(formData);
  const fieldErrors: FieldErrors = {
    ...profileErrors(values, profile),
    ...(photo.error ? { photo: [photo.error] } : {}),
  };
  if (!profile.success || hasErrors(fieldErrors)) {
    return failure("Check the highlighted fields.", fieldErrors);
  }

  // Only an admin moves a student to another home branch.
  let homeBranchId = student.homeBranchId;
  if (user.role === "admin" && values.homeBranchId && values.homeBranchId !== homeBranchId) {
    const branch = await prisma.branch.findUnique({ where: { id: values.homeBranchId } });
    if (!branch?.active) {
      return failure("Check the highlighted fields.", { homeBranchId: ["Pick an active branch."] });
    }
    homeBranchId = branch.id;
  }

  const removePhoto = values.removePhoto === "on";
  const uploaded = photo.file ? await uploadStudentPhoto(photo.file) : null;
  const { registrationDate, ...details } = profile.data;

  try {
    await prisma.student.update({
      where: { id },
      data: {
        ...details,
        registrationDate: toDbDate(registrationDate),
        homeBranchId,
        ...(uploaded
          ? { photoUrl: uploaded.url, photoPublicId: uploaded.publicId }
          : removePhoto
            ? { photoUrl: null, photoPublicId: null }
            : {}),
      },
    });
  } catch (error) {
    if (uploaded) await deleteStudentPhoto(uploaded.publicId).catch(() => {});
    throw error;
  }

  // The old photo goes only after the new details are safely saved.
  if ((uploaded || removePhoto) && student.photoPublicId) {
    await deleteStudentPhoto(student.photoPublicId).catch(() => {});
  }

  return success("Student details saved.", { id });
}

export async function enrollStudent(studentId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const values = formObject(formData);
  const parsed = z
    .object({
      branchSkillId: z.string({ error: "Pick a skill." }).min(1, "Pick a skill."),
      startDate: isoDate("Pick the start date."),
    })
    .safeParse(values);
  if (!parsed.success) return invalid(parsed.error);

  const [student, branchSkill] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId } }),
    prisma.branchSkill.findUnique({
      where: { id: parsed.data.branchSkillId },
      include: { skill: true, branch: true },
    }),
  ]);
  if (!student) return failure("That student no longer exists.");
  if (!branchSkill?.active || !branchSkill.skill.active || !branchSkill.branch.active) {
    return failure("This skill isn't taking new students at that branch.");
  }
  if (!canActAtBranch(user, branchSkill.branchId)) {
    return failure("You can only enroll students in skills at your own branch.");
  }

  // Paid now means paid today, whatever the start date.
  const fee = readFeePaidNow(values, collegeToday());
  if (Object.keys(fee.errors).length > 0) {
    return failure("Check the highlighted fields.", fee.errors);
  }

  try {
    await prisma.enrollment.create({
      data: enrollmentData(student.id, user.id, parsed.data.startDate, branchSkill, fee.paid),
    });
  } catch (error) {
    // The database allows one active enrollment per skill per student, at any branch.
    if (isUniqueViolation(error)) {
      return failure(`${student.fullName} is already taking ${branchSkill.skill.name}.`);
    }
    throw error;
  }

  refresh();
  return success(`${student.fullName} now takes ${branchSkill.skill.name}.`);
}

export async function setEnrollmentStatus(
  enrollmentId: string,
  status: "ACTIVE" | "FINISHED" | "DROPPED",
): Promise<ActionResult> {
  const user = await requireUser();
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { skill: { select: { name: true } }, branchSkill: { select: { branchId: true } } },
  });
  if (!enrollment) return failure("That skill record no longer exists.");
  if (!canActAtBranch(user, enrollment.branchSkill.branchId)) {
    return failure("Only staff at the skill's branch can change it.");
  }
  if (enrollment.status === status) return success();

  try {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status, statusChangedAt: new Date() },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure(
        `The student is already taking ${enrollment.skill.name} again. Finish or drop that one first.`,
      );
    }
    throw error;
  }

  refresh();
  const done = { ACTIVE: "is active again", FINISHED: "marked finished", DROPPED: "marked dropped" };
  return success(`${enrollment.skill.name} ${done[status]}.`);
}

// --- Registration fees --------------------------------------------------------
//
// The fee itself lives on the enrollment; whether it was paid is a payment in
// the ledger, recorded by finance/income/actions.ts. Only the admin lowers or
// waives a fee, and only while it's unpaid.

/** Lowers or waives one student's fee for one skill. Admin only. */
export async function changeRegistrationFee(
  enrollmentId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ registrationFee: money("Enter the fee, or 0 to waive it.") })
    .safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { skill: { select: { name: true } } },
  });
  if (!enrollment) return failure("That skill record no longer exists.");

  // A paid fee stays at what was paid, so what the books say the student
  // handed over always matches the fee on record. The check rides along in
  // the update itself, so a payment recorded this moment still wins.
  const { count } = await prisma.enrollment.updateMany({
    where: { id: enrollmentId, payments: { none: { category: "REGISTRATION_FEE" } } },
    data: { registrationFee: parsed.data.registrationFee },
  });
  if (count === 0) {
    return failure("This registration fee is already paid. Remove the payment first to change it.");
  }

  refresh();
  const fee = Number(parsed.data.registrationFee);
  return success(
    fee === 0
      ? `${enrollment.skill.name} registration fee waived.`
      : `${enrollment.skill.name} registration fee set to ${formatMoney(fee)}.`,
  );
}

/**
 * For duplicates and typing mistakes. Removes the student and all their
 * skills. A student who has paid even one monthly fee can't be deleted: the
 * fee is income, and a percentage teacher may already have been paid a share
 * of it, so the record stays and the student is dropped from their skills
 * instead, which shows them as Inactive.
 */
export async function deleteStudent(id: string): Promise<ActionResult> {
  await requireAdmin();
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return failure("That student no longer exists.");

  const monthsPaid = await prisma.payment.count({ where: { studentId: id, category: "MONTHLY_FEE" } });
  if (monthsPaid > 0) {
    return failure(
      `${formatStudentNumber(student.number)} has paid monthly fees, so they can't be deleted. Drop their skills instead and they show as Inactive.`,
    );
  }

  await prisma.student.delete({ where: { id } });
  if (student.photoPublicId) await deleteStudentPhoto(student.photoPublicId).catch(() => {});

  return success(`${formatStudentNumber(student.number)} deleted.`);
}

/**
 * Students who already use this phone number, as theirs or their responsible
 * person's. Staff see matches from every branch: an exact phone lookup is
 * allowed across branches so the same person isn't registered twice.
 */
export async function findStudentsByPhone(phone: string, excludeId?: string): Promise<PhoneMatch[]> {
  await requireUser();
  const stored = toStoredPhone(phone);
  if (!stored) return [];

  const matches = await prisma.student.findMany({
    where: {
      OR: [{ phone: stored }, { responsiblePhone: stored }],
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    take: 5,
    orderBy: { number: "asc" },
    include: { homeBranch: { select: { name: true } } },
  });

  return matches.map((student) => ({
    id: student.id,
    number: formatStudentNumber(student.number),
    fullName: student.fullName,
    branchName: student.homeBranch.name,
  }));
}

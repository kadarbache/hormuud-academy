"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { Weekday } from "@/generated/prisma/client";
import { formatSlot, parseClock, slotOf } from "@/lib/class-times";
import { studentClash, teacherClash } from "@/lib/clashes";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import {
  failure,
  invalid,
  isUniqueViolation,
  success,
  type ActionResult,
} from "@/lib/action-result";
import { sameNameAs } from "@/lib/unique-name";
import { formObject, requiredId, requiredText } from "@/lib/validation";

// A class time is one branch skill under a short name, from a start time to
// an end time on chosen days, with one teacher. The teacher works at the
// skill's branch, and nobody may be in two places at once (src/lib/clashes.ts).
// The app doesn't keep the room it meets in.

/** A time from an <input type="time">, as minutes after midnight. */
const clock = (message: string) =>
  z
    .string({ error: message })
    .refine((value) => parseClock(value) !== null, message)
    .transform((value) => parseClock(value) ?? 0);

/** The form, read into what a class time stores: the times become minutes. */
const classTimeSchema = z
  .object({
    name: requiredText("Give it a name, like 1 or 2.", 40),
    teacherId: requiredId("Pick the teacher."),
    startTime: clock("Enter the time it starts."),
    endTime: clock("Enter the time it ends."),
    days: z
      .array(z.enum(Weekday, { error: "Pick days from the list." }))
      .min(1, "Pick at least one day.")
      .transform((days) => [...new Set(days)]),
  })
  .refine((input) => input.endTime > input.startTime, {
    path: ["endTime"],
    message: "It has to end after it starts.",
  })
  .transform(({ startTime, endTime, ...rest }) => ({
    ...rest,
    startMinute: startTime,
    endMinute: endTime,
  }));

type ClassTimeInput = z.infer<typeof classTimeSchema>;

function readClassTime(formData: FormData) {
  return classTimeSchema.safeParse({ ...formObject(formData), days: formData.getAll("days") });
}

const highlighted = (field: string, message: string) =>
  failure("Check the highlighted fields.", { [field]: [message] });

const nameTaken = (name: string) =>
  highlighted("name", `This skill already has a class time called ${name} at this branch. Pick another name.`);

/**
 * Checks that no other class time of the skill at the branch has the name,
 * whatever its capitals, and that the teacher is active and at the branch.
 * `id` is the class time being changed, left out when adding one.
 */
async function nameOrTeacherProblem(
  branchSkill: { id: string; branchId: string },
  input: ClassTimeInput,
  id?: string,
) {
  const [sameName, teacher] = await Promise.all([
    prisma.classTime.findFirst({
      where: { branchSkillId: branchSkill.id, ...sameNameAs(input.name, id) },
    }),
    prisma.teacher.findUnique({
      where: { id: input.teacherId },
      include: { branches: { where: { branchId: branchSkill.branchId } } },
    }),
  ]);

  if (sameName) return nameTaken(sameName.name);
  if (!teacher?.active || teacher.branches.length === 0) {
    return highlighted("teacherId", "Pick an active teacher who works at this branch.");
  }
  return null;
}

export async function addClassTime(branchSkillId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = readClassTime(formData);
  if (!parsed.success) return invalid(parsed.error);

  const branchSkill = await prisma.branchSkill.findUnique({ where: { id: branchSkillId } });
  if (!branchSkill) return failure("That branch setup no longer exists.");
  const problem = await nameOrTeacherProblem(branchSkill, parsed.data);
  if (problem) return problem;

  const clash = await teacherClash({ branchSkillId, ...parsed.data, slot: parsed.data });
  if (clash) return highlighted("teacherId", clash);

  try {
    await prisma.classTime.create({ data: { branchSkillId, ...parsed.data } });
  } catch (error) {
    // Someone else gave a class time the name in the meantime.
    if (isUniqueViolation(error)) return nameTaken(parsed.data.name);
    throw error;
  }
  refresh();
  return success(`Class time ${parsed.data.name} added: ${formatSlot(parsed.data)}.`);
}

/**
 * Changing the hours or days moves every student in the class time, so they
 * are checked against the other skills they take. A new teacher earns the
 * share of fees paid from now on; fees already paid keep the teacher they
 * were paid under.
 */
export async function updateClassTime(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = readClassTime(formData);
  if (!parsed.success) return invalid(parsed.error);

  const classTime = await prisma.classTime.findUnique({
    where: { id },
    include: {
      branchSkill: { select: { id: true, branchId: true } },
      enrollments: { where: { status: "ACTIVE" }, select: { studentId: true } },
    },
  });
  if (!classTime) return failure("That class time no longer exists.");
  const problem = await nameOrTeacherProblem(classTime.branchSkill, parsed.data, id);
  if (problem) return problem;

  const clash = await teacherClash({
    id,
    branchSkillId: classTime.branchSkillId,
    ...parsed.data,
    slot: parsed.data,
  });
  if (clash) return highlighted("teacherId", clash);
  const students = await studentClash(
    classTime.enrollments.map((enrollment) => enrollment.studentId),
    parsed.data,
    { classTimeId: id },
  );
  if (students) return failure(`A student in this class time would be in two places at once. ${students}`);

  try {
    await prisma.classTime.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken(parsed.data.name);
    throw error;
  }
  refresh();
  return success("Class time saved.");
}

/**
 * An inactive class time takes no new students. The ones already in it stay,
 * and it keeps its teacher until they've all finished or moved.
 */
export async function setClassTimeActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const classTime = await prisma.classTime.findUnique({
    where: { id },
    include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
  });
  if (!classTime) return failure("That class time no longer exists.");

  // Switched off with nobody in it, it held nothing, so switching it back on
  // has to find its teacher free again.
  const slot = slotOf(classTime);
  if (active && slot) {
    const clash = await teacherClash({ ...classTime, slot });
    if (clash) return failure(clash);
  }

  await prisma.classTime.update({ where: { id }, data: { active } });
  refresh();
  const students = classTime._count.enrollments;
  return success(
    active
      ? "Class time is taking students again."
      : students > 0
        ? `Class time deactivated. Its ${students === 1 ? "student stays" : `${students} students stay`}, but nobody new can join.`
        : "Class time deactivated.",
  );
}

export async function deleteClassTime(id: string): Promise<ActionResult> {
  await requireAdmin();
  const classTime = await prisma.classTime.findUnique({
    where: { id },
    include: { _count: { select: { enrollments: true, attendanceSheets: true } } },
  });
  if (!classTime) return failure("That class time no longer exists.");
  // Moving every student out leaves no enrollments, but its attendance stays.
  if (classTime._count.enrollments > 0 || classTime._count.attendanceSheets > 0) {
    return failure("Students have been in this class time. Deactivate it instead.");
  }

  await prisma.classTime.delete({ where: { id } });
  refresh();
  return success("Class time removed.");
}

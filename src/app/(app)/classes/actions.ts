"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sameNameAs } from "@/lib/unique-name";
import { requireAdmin } from "@/lib/session";
import {
  failure,
  invalid,
  isUniqueViolation,
  success,
  type ActionResult,
} from "@/lib/action-result";
import { formObject, requiredId, requiredText } from "@/lib/validation";

// The screens say "class"; the table is `classrooms` (see CONTEXT.md).
const classSchema = z.object({
  name: requiredText("Enter the class name, like Room 3.", 60),
  branchId: requiredId("Pick the branch this class is in."),
});

const nameTaken = failure("Check the highlighted fields.", {
  name: ["This branch already has a class with this name."],
});

export async function createClassroom(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = classSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const branch = await prisma.branch.findUnique({ where: { id: parsed.data.branchId } });
  if (!branch?.active) return failure("Pick an active branch.");
  const clash = await prisma.classroom.findFirst({
    where: { ...sameNameAs(parsed.data.name), branchId: branch.id },
  });
  if (clash) return nameTaken;

  try {
    await prisma.classroom.create({ data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken;
    throw error;
  }

  refresh();
  return success(`${parsed.data.name} added to ${branch.name}.`);
}

/** A class can be renamed but not moved: skills at its branch already use it. */
export async function renameClassroom(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = classSchema.pick({ name: true }).safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const classroom = await prisma.classroom.findUnique({ where: { id } });
  if (!classroom) return failure("That class no longer exists.");
  const clash = await prisma.classroom.findFirst({
    where: { ...sameNameAs(parsed.data.name, id), branchId: classroom.branchId },
  });
  if (clash) return nameTaken;

  try {
    await prisma.classroom.update({ where: { id }, data: { name: parsed.data.name } });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken;
    throw error;
  }

  refresh();
  return success("Class renamed.");
}

export async function setClassroomActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const classroom = await prisma.classroom.update({ where: { id }, data: { active } });
  refresh();
  return success(active ? `${classroom.name} is active again.` : `${classroom.name} deactivated.`);
}

export async function deleteClassroom(id: string): Promise<ActionResult> {
  await requireAdmin();
  const classroom = await prisma.classroom.findUnique({
    where: { id },
    include: { _count: { select: { branchSkills: true } } },
  });
  if (!classroom) return failure("That class no longer exists.");
  if (classroom._count.branchSkills > 0) {
    return failure("A skill is taught in this class. Deactivate it instead.");
  }

  await prisma.classroom.delete({ where: { id } });
  refresh();
  return success(`${classroom.name} deleted.`);
}

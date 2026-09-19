"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { formObject, optionalPhone, requiredText } from "@/lib/validation";

const teacherSchema = z.object({
  name: requiredText("Enter the teacher's name.", 100),
  phone: optionalPhone,
  branchIds: z.array(z.string().min(1)).min(1, "Pick at least one branch."),
});

function readTeacher(formData: FormData) {
  return teacherSchema.safeParse({
    ...formObject(formData),
    branchIds: formData.getAll("branchIds"),
  });
}

async function unknownBranches(branchIds: string[]) {
  const found = await prisma.branch.count({ where: { id: { in: branchIds } } });
  return found !== new Set(branchIds).size;
}

export async function createTeacher(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = readTeacher(formData);
  if (!parsed.success) return invalid(parsed.error);
  const { name, phone, branchIds } = parsed.data;
  if (await unknownBranches(branchIds)) return failure("One of those branches no longer exists.");

  await prisma.teacher.create({
    data: {
      name,
      phone,
      branches: { create: [...new Set(branchIds)].map((branchId) => ({ branchId })) },
    },
  });

  refresh();
  return success(`${name} added.`);
}

export async function updateTeacher(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = readTeacher(formData);
  if (!parsed.success) return invalid(parsed.error);
  const { name, phone, branchIds } = parsed.data;
  if (await unknownBranches(branchIds)) return failure("One of those branches no longer exists.");

  // Unticking a branch where this teacher still runs a skill would leave that
  // skill with a teacher who doesn't work there.
  const stillTeaching = await prisma.branchSkill.findFirst({
    where: { teacherId: id, branchId: { notIn: branchIds } },
    include: { skill: { select: { name: true } }, branch: { select: { name: true } } },
  });
  if (stillTeaching) {
    return failure("Check the highlighted fields.", {
      branchIds: [
        `${name} still teaches ${stillTeaching.skill.name} at ${stillTeaching.branch.name}. Give that skill another teacher first.`,
      ],
    });
  }

  await prisma.$transaction([
    prisma.teacher.update({ where: { id }, data: { name, phone } }),
    prisma.teacherBranch.deleteMany({ where: { teacherId: id, branchId: { notIn: branchIds } } }),
    prisma.teacherBranch.createMany({
      data: branchIds.map((branchId) => ({ teacherId: id, branchId })),
      skipDuplicates: true,
    }),
  ]);

  refresh();
  return success("Teacher saved.");
}

export async function setTeacherActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();

  if (!active) {
    const teaching = await prisma.branchSkill.findFirst({
      where: { teacherId: id, active: true },
      include: { skill: { select: { name: true } }, branch: { select: { name: true } } },
    });
    if (teaching) {
      return failure(
        `This teacher still runs ${teaching.skill.name} at ${teaching.branch.name}. Give that skill another teacher first.`,
      );
    }
  }

  const teacher = await prisma.teacher.update({ where: { id }, data: { active } });
  refresh();
  return success(active ? `${teacher.name} is active again.` : `${teacher.name} deactivated.`);
}

export async function deleteTeacher(id: string): Promise<ActionResult> {
  await requireAdmin();
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: { _count: { select: { branchSkills: true } } },
  });
  if (!teacher) return failure("That teacher no longer exists.");
  if (teacher._count.branchSkills > 0) {
    return failure("This teacher is set on a skill. Deactivate them instead.");
  }

  await prisma.teacher.delete({ where: { id } });
  refresh();
  return success(`${teacher.name} deleted.`);
}

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
import { formObject, money, requiredId, requiredText } from "@/lib/validation";

// --- The catalog skill -------------------------------------------------------

const skillSchema = z.object({
  name: requiredText("Enter the skill name.", 100),
  categoryId: requiredId("Pick a category."),
  durationMonths: z.coerce
    .number({ error: "Enter the number of months." })
    .int("Use whole months.")
    .min(1, "At least 1 month.")
    .max(60, "At most 60 months."),
  monthlyFee: money,
});

const skillNameTaken = failure("Check the highlighted fields.", {
  name: ["There's already a skill with this name."],
});

async function checkCategory(categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  return category?.active ? null : failure("Pick an active category.");
}

export async function createSkill(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = skillSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const categoryProblem = await checkCategory(parsed.data.categoryId);
  if (categoryProblem) return categoryProblem;
  if (await prisma.skill.findFirst({ where: sameNameAs(parsed.data.name) })) return skillNameTaken;

  try {
    const skill = await prisma.skill.create({ data: parsed.data });
    refresh();
    return success(`${skill.name} added. Now set the branches that teach it.`, { id: skill.id });
  } catch (error) {
    if (isUniqueViolation(error)) return skillNameTaken;
    throw error;
  }
}

/**
 * Changing the fee or duration only affects students who join from now on.
 * Each enrollment keeps the fee and end date it was created with.
 */
export async function updateSkill(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = skillSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const current = await prisma.skill.findUnique({ where: { id } });
  if (!current) return failure("That skill no longer exists.");
  if (current.categoryId !== parsed.data.categoryId) {
    const categoryProblem = await checkCategory(parsed.data.categoryId);
    if (categoryProblem) return categoryProblem;
  }
  if (await prisma.skill.findFirst({ where: sameNameAs(parsed.data.name, id) })) return skillNameTaken;

  try {
    await prisma.skill.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return skillNameTaken;
    throw error;
  }

  refresh();
  return success("Skill saved.");
}

export async function setSkillActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const skill = await prisma.skill.update({ where: { id }, data: { active } });
  refresh();
  return success(
    active ? `${skill.name} is active again.` : `${skill.name} deactivated. Current students keep it.`,
  );
}

export async function deleteSkill(id: string): Promise<ActionResult> {
  await requireAdmin();
  const skill = await prisma.skill.findUnique({
    where: { id },
    include: { _count: { select: { branchSkills: true, enrollments: true } } },
  });
  if (!skill) return failure("That skill no longer exists.");
  if (skill._count.branchSkills > 0 || skill._count.enrollments > 0) {
    return failure("A branch teaches this skill. Deactivate it instead.");
  }

  await prisma.skill.delete({ where: { id } });
  refresh();
  return success(`${skill.name} deleted.`);
}

// --- The skill at one branch -------------------------------------------------

const placementSchema = z.object({
  teacherId: requiredId("Pick the teacher."),
  classroomId: requiredId("Pick the class."),
});

/** Checks that the teacher works at the branch and the class is in it. */
async function checkPlacement(branchId: string, teacherId: string, classroomId: string) {
  const [teacher, classroom] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { branches: { where: { branchId } } },
    }),
    prisma.classroom.findUnique({ where: { id: classroomId } }),
  ]);

  if (!teacher?.active || teacher.branches.length === 0) {
    return failure("Check the highlighted fields.", {
      teacherId: ["Pick an active teacher who works at this branch."],
    });
  }
  if (!classroom?.active || classroom.branchId !== branchId) {
    return failure("Check the highlighted fields.", {
      classroomId: ["Pick an active class at this branch."],
    });
  }
  return null;
}

export async function addBranchSkill(skillId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const values = formObject(formData);
  const parsed = placementSchema
    .extend({ branchId: requiredId("Pick the branch.") })
    .safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const { branchId, teacherId, classroomId } = parsed.data;

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch?.active) return failure("Pick an active branch.");
  const placementProblem = await checkPlacement(branchId, teacherId, classroomId);
  if (placementProblem) return placementProblem;

  try {
    await prisma.branchSkill.create({ data: { skillId, branchId, teacherId, classroomId } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Check the highlighted fields.", {
        branchId: [`${branch.name} already teaches this skill.`],
      });
    }
    throw error;
  }

  refresh();
  return success(`${branch.name} now teaches this skill.`);
}

export async function updateBranchSkill(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = placementSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const branchSkill = await prisma.branchSkill.findUnique({ where: { id } });
  if (!branchSkill) return failure("That branch setup no longer exists.");
  const placementProblem = await checkPlacement(
    branchSkill.branchId,
    parsed.data.teacherId,
    parsed.data.classroomId,
  );
  if (placementProblem) return placementProblem;

  await prisma.branchSkill.update({ where: { id }, data: parsed.data });
  refresh();
  return success("Teacher and class saved.");
}

export async function setBranchSkillActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const branchSkill = await prisma.branchSkill.update({
    where: { id },
    data: { active },
    include: { branch: { select: { name: true } } },
  });
  refresh();
  return success(
    active
      ? `${branchSkill.branch.name} teaches it again.`
      : `${branchSkill.branch.name} stopped taking new students for it.`,
  );
}

export async function deleteBranchSkill(id: string): Promise<ActionResult> {
  await requireAdmin();
  const branchSkill = await prisma.branchSkill.findUnique({
    where: { id },
    include: { branch: { select: { name: true } }, _count: { select: { enrollments: true } } },
  });
  if (!branchSkill) return failure("That branch setup no longer exists.");
  if (branchSkill._count.enrollments > 0) {
    return failure("Students have taken this skill at this branch. Deactivate it instead.");
  }

  await prisma.branchSkill.delete({ where: { id } });
  refresh();
  return success(`Removed from ${branchSkill.branch.name}.`);
}

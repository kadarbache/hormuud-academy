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

/** Duration and fees, set on the skill as defaults and on each branch skill. */
const pricingSchema = z.object({
  durationMonths: z.coerce
    .number({ error: "Enter the number of months." })
    .int("Use whole months.")
    .min(1, "At least 1 month.")
    .max(60, "At most 60 months."),
  registrationFee: money("Enter the registration fee, or 0 if there's none."),
  monthlyFee: money("Enter the monthly fee."),
});

const skillSchema = pricingSchema.extend({
  name: requiredText("Enter the skill name.", 100),
  categoryId: requiredId("Pick a category."),
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
 * The fees and duration here are only defaults for branches added from now on.
 * Branches that already teach the skill keep their own.
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

export async function addBranchSkill(skillId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = pricingSchema
    .extend({ branchId: requiredId("Pick the branch.") })
    .safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const branch = await prisma.branch.findUnique({ where: { id: parsed.data.branchId } });
  if (!branch?.active) return failure("Pick an active branch.");

  try {
    await prisma.branchSkill.create({ data: { skillId, ...parsed.data } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Check the highlighted fields.", {
        branchId: [`${branch.name} already teaches this skill.`],
      });
    }
    throw error;
  }

  refresh();
  return success(`${branch.name} now teaches this skill. Add its class times so students can join.`);
}

/**
 * A new fee or duration only affects students who join from now on. Each
 * enrollment keeps the fees and end date it was created with.
 */
export async function updateBranchSkill(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = pricingSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const branchSkill = await prisma.branchSkill.findUnique({ where: { id } });
  if (!branchSkill) return failure("That branch setup no longer exists.");

  await prisma.branchSkill.update({ where: { id }, data: parsed.data });
  refresh();
  return success("Branch setup saved.");
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

  // Nobody ever joined, so its class times go with it.
  await prisma.$transaction([
    prisma.classTime.deleteMany({ where: { branchSkillId: id } }),
    prisma.branchSkill.delete({ where: { id } }),
  ]);
  refresh();
  return success(`Removed from ${branchSkill.branch.name}.`);
}

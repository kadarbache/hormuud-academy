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
import { formObject, optionalPhone, optionalText, requiredText } from "@/lib/validation";

const branchSchema = z.object({
  name: requiredText("Enter the branch name.", 100),
  phone: optionalPhone,
  address: optionalText(200),
});

const nameTaken = failure("Check the highlighted fields.", {
  name: ["There's already a branch with this name."],
});

export async function createBranch(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = branchSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (await prisma.branch.findFirst({ where: sameNameAs(parsed.data.name) })) return nameTaken;

  try {
    await prisma.branch.create({ data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken;
    throw error;
  }

  refresh();
  return success(`${parsed.data.name} added.`);
}

export async function updateBranch(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = branchSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (await prisma.branch.findFirst({ where: sameNameAs(parsed.data.name, id) })) return nameTaken;

  try {
    await prisma.branch.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken;
    throw error;
  }

  refresh();
  return success("Branch saved.");
}

export async function setBranchActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const branch = await prisma.branch.update({ where: { id }, data: { active } });
  refresh();
  return success(active ? `${branch.name} is active again.` : `${branch.name} deactivated.`);
}

export async function deleteBranch(id: string): Promise<ActionResult> {
  await requireAdmin();
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      _count: {
        select: { staff: true, classrooms: true, teachers: true, branchSkills: true, homeStudents: true },
      },
    },
  });
  if (!branch) return failure("That branch no longer exists.");

  const inUse = Object.values(branch._count).some((count) => count > 0);
  if (inUse) {
    return failure("This branch has staff, classes, teachers, skills or students. Deactivate it instead.");
  }

  await prisma.branch.delete({ where: { id } });
  refresh();
  return success(`${branch.name} deleted.`);
}

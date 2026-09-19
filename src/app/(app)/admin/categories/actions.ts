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
import { formObject, requiredText } from "@/lib/validation";

const categorySchema = z.object({
  name: requiredText("Enter the category name.", 80),
});

const nameTaken = failure("Check the highlighted fields.", {
  name: ["There's already a category with this name."],
});

export async function createCategory(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (await prisma.category.findFirst({ where: sameNameAs(parsed.data.name) })) return nameTaken;

  try {
    await prisma.category.create({ data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken;
    throw error;
  }

  refresh();
  return success(`${parsed.data.name} added.`);
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (await prisma.category.findFirst({ where: sameNameAs(parsed.data.name, id) })) return nameTaken;

  try {
    await prisma.category.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken;
    throw error;
  }

  refresh();
  return success("Category saved.");
}

export async function setCategoryActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const category = await prisma.category.update({ where: { id }, data: { active } });
  refresh();
  return success(active ? `${category.name} is active again.` : `${category.name} deactivated.`);
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { skills: true } } },
  });
  if (!category) return failure("That category no longer exists.");
  if (category._count.skills > 0) {
    return failure("Skills still use this category. Deactivate it instead.");
  }

  await prisma.category.delete({ where: { id } });
  refresh();
  return success(`${category.name} deleted.`);
}

"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  failure,
  invalid,
  isForeignKeyViolation,
  isUniqueViolation,
  success,
  type ActionResult,
} from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { sameNameAs } from "@/lib/unique-name";
import { formObject, requiredText } from "@/lib/validation";
import { TEACHER_SALARY_ID } from "../labels";

// The admin's list of what money goes on. Every change is refused for Teacher
// salary: teacher pay is recorded in it and found by its id, so it stays as
// the migration made it.

const categorySchema = z.object({
  name: requiredText("Enter the category name.", 60),
});

const nameTaken = failure("Check the highlighted fields.", {
  name: ["There's already an expense category with this name."],
});

const builtIn = failure(
  "Teacher salary can't be changed: teacher pay is recorded in it.",
);

export async function createExpenseCategory(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (await prisma.expenseCategory.findFirst({ where: sameNameAs(parsed.data.name) })) {
    return nameTaken;
  }

  try {
    await prisma.expenseCategory.create({ data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken;
    throw error;
  }

  refresh();
  return success(`${parsed.data.name} added.`);
}

export async function renameExpenseCategory(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (id === TEACHER_SALARY_ID) return builtIn;
  const parsed = categorySchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (await prisma.expenseCategory.findFirst({ where: sameNameAs(parsed.data.name, id) })) {
    return nameTaken;
  }

  try {
    await prisma.expenseCategory.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken;
    throw error;
  }

  refresh();
  return success("Category renamed.");
}

export async function setExpenseCategoryActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (id === TEACHER_SALARY_ID) return builtIn;
  const category = await prisma.expenseCategory.update({ where: { id }, data: { active } });
  refresh();
  return success(active ? `${category.name} is active again.` : `${category.name} deactivated.`);
}

/**
 * Only for a category nothing uses yet. Once an expense or a budget plan is in
 * it, taking it away would change what past months add up to, so it can only
 * be deactivated.
 */
export async function deleteExpenseCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (id === TEACHER_SALARY_ID) return builtIn;
  const category = await prisma.expenseCategory.findUnique({
    where: { id },
    include: { _count: { select: { expenses: true, budgetLines: true } } },
  });
  if (!category) return failure("That category no longer exists.");

  const inUse = failure(`${category.name} is already in use. Deactivate it instead.`);
  if (category._count.expenses > 0 || category._count.budgetLines > 0) return inUse;

  try {
    await prisma.expenseCategory.delete({ where: { id } });
  } catch (error) {
    // An expense recorded in it since the check above.
    if (isForeignKeyViolation(error)) return inUse;
    throw error;
  }

  refresh();
  return success(`${category.name} deleted.`);
}

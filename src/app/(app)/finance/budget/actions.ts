"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ExpenseCategory } from "@/generated/prisma/client";
import {
  failure,
  invalid,
  success,
  type ActionResult,
  type FieldErrors,
} from "@/lib/action-result";
import { formatMonth, toDbMonth } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formObject, isoMonth, money, optionalText } from "@/lib/validation";
import { expenseCategories, lineField } from "../labels";

// Writing the plan for a month. A branch has at most one plan per month, so
// saving again replaces what was there rather than adding a second one.

/**
 * The planned amount for each expense category. An empty box means nothing
 * was planned for it, which is different from planning zero only in that no
 * line is kept; either way spending on it still shows as unplanned.
 */
function readLines(values: Record<string, string>) {
  const lines: { category: ExpenseCategory; amount: string }[] = [];
  const errors: FieldErrors = {};

  for (const category of expenseCategories) {
    const field = lineField(category);
    const raw = values[field]?.trim();
    if (!raw) continue;

    const parsed = money("Enter an amount like 300 or 300.50.").safeParse(raw);
    if (!parsed.success) {
      errors[field] = ["Enter an amount like 300 or 300.50."];
      continue;
    }
    if (Number(parsed.data) > 0) lines.push({ category, amount: parsed.data });
  }

  return { lines, errors };
}

export async function saveBudget(
  branchId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAdmin();
  const values = formObject(formData);

  const parsed = z
    .object({
      month: isoMonth("Pick the month this plan is for."),
      expectedIncome: money("Enter the income you expect."),
      note: optionalText(300),
    })
    .safeParse(values);
  const { lines, errors } = readLines(values);

  if (!parsed.success) {
    return failure("Check the highlighted fields.", {
      ...z.flattenError(parsed.error).fieldErrors,
      ...errors,
    });
  }
  if (Object.keys(errors).length > 0) return failure("Check the highlighted fields.", errors);

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) return failure("That branch no longer exists.");

  const month = toDbMonth(parsed.data.month);
  await prisma.$transaction(async (tx) => {
    const budget = await tx.monthlyBudget.upsert({
      where: { branchId_month: { branchId, month } },
      create: {
        branchId,
        month,
        expectedIncome: parsed.data.expectedIncome,
        note: parsed.data.note,
        savedById: user.id,
      },
      update: {
        expectedIncome: parsed.data.expectedIncome,
        note: parsed.data.note,
        savedById: user.id,
      },
    });
    // The lines are rewritten wholesale: a category cleared on the form has
    // to lose its line, not keep the old amount.
    await tx.monthlyBudgetLine.deleteMany({ where: { budgetId: budget.id } });
    if (lines.length > 0) {
      await tx.monthlyBudgetLine.createMany({
        data: lines.map((line) => ({ budgetId: budget.id, ...line })),
      });
    }
  });

  refresh();
  return success(`${branch.name}'s plan for ${formatMonth(parsed.data.month)} saved.`);
}

/** Throws the plan away. The month's actual figures are untouched. */
export async function deleteBudget(branchId: string, month: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = isoMonth().safeParse(month);
  if (!parsed.success) return invalid(parsed.error);

  const { count } = await prisma.monthlyBudget.deleteMany({
    where: { branchId, month: toDbMonth(parsed.data) },
  });
  if (count === 0) return failure("There's no plan for that month to remove.");

  refresh();
  return success(`The plan for ${formatMonth(parsed.data)} was removed.`);
}

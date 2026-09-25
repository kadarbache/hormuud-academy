import "server-only";
import type { Option } from "@/components/select-input";
import { prisma } from "@/lib/prisma";

export type ExpenseCategoryChoice = { id: string; name: string; active: boolean };

/** Every expense category from A to Z, the deactivated ones included. */
export function listExpenseCategories(): Promise<ExpenseCategoryChoice[]> {
  return prisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });
}

/**
 * What an expense can be put in: the active categories, plus the one it's in
 * already, so editing an old expense in a deactivated category keeps it.
 */
export function expenseCategoryOptions(
  categories: ExpenseCategoryChoice[],
  current?: string,
): Option[] {
  return categories
    .filter((category) => category.active || category.id === current)
    .map((category) => ({ value: category.id, label: category.name }));
}

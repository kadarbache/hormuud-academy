import "server-only";
import type { ExpenseCategory, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { one, type SearchParams } from "@/lib/search-params";
import { ANY, expenseCategories } from "../labels";
import { periodFilter, readPeriod, type Period } from "../period";

export const PAGE_SIZE = 25;

export type ExpenseFilters = {
  period: Period;
  /** Empty means every branch. */
  branchId: string;
  category: ExpenseCategory | "";
  teacherId: string;
  page: number;
};

export function readExpenseFilters(params: SearchParams): ExpenseFilters {
  const branch = one(params, "branch");
  const category = one(params, "category");
  const page = Number.parseInt(one(params, "page"), 10);
  // Expenses are read a month at a time far more often than a day at a time,
  // so a link with no period on it opens the month.
  const period = one(params, "period") || "month";
  return {
    period: readPeriod({ ...params, period }),
    branchId: branch === ANY ? "" : branch,
    category: (expenseCategories as string[]).includes(category)
      ? (category as ExpenseCategory)
      : "",
    teacherId: one(params, "teacher"),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function expenseWhere(filters: ExpenseFilters): Prisma.ExpenseWhereInput {
  const conditions: Prisma.ExpenseWhereInput[] = [];
  if (filters.branchId) conditions.push({ branchId: filters.branchId });
  const spentOn = periodFilter(filters.period);
  if (spentOn) conditions.push({ spentOn });
  if (filters.category) conditions.push({ category: filters.category });
  if (filters.teacherId) conditions.push({ teacherId: filters.teacherId });
  return { AND: conditions };
}

export async function listExpenses(where: Prisma.ExpenseWhereInput, page: number) {
  const [total, rows] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: [{ spentOn: "desc" }, { number: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        branch: { select: { name: true } },
        teacher: { select: { id: true, name: true } },
        recordedBy: { select: { name: true } },
      },
    }),
  ]);

  return { total, rows, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Branches an expense can be booked against. */
export async function branchChoices() {
  const branches = await prisma.branch.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });
  return branches;
}

/** Teachers a salary can be paid to. */
export async function teacherChoices() {
  const teachers = await prisma.teacher.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return teachers.map((teacher) => ({ value: teacher.id, label: teacher.name }));
}

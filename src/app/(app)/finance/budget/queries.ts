import "server-only";
import type { ExpenseCategory } from "@/generated/prisma/client";
import { monthEnd, monthStart, toDbDate, toDbMonth } from "@/lib/dates";
import { fromCents, subtractMoney, sumMoney, toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { expenseCategories } from "../labels";

// The plan for a month, next to what actually happened.
//
// Only the plan is stored. The actual figures are counted from the payments
// and expenses every time the screen is opened, so a payment recorded late
// shows up in last month's comparison the moment it's entered.

function monthRange(month: string) {
  return { gte: toDbDate(monthStart(month)), lte: toDbDate(monthEnd(month)) };
}

function amount(value: { toString(): string } | null | undefined) {
  return fromCents(toCents(value?.toString() ?? 0));
}

export type BranchMonth = {
  branchId: string;
  branchName: string;
  planned: boolean;
  expectedIncome: string;
  plannedExpenses: string;
  actualIncome: string;
  actualExpenses: string;
  plannedNet: string;
  actualNet: string;
};

/** Every branch's plan against its actuals for one month. */
export async function budgetOverview(month: string): Promise<BranchMonth[]> {
  const paidOn = monthRange(month);
  const [branches, budgets, income, expenses] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.monthlyBudget.findMany({ where: { month: toDbMonth(month) }, include: { lines: true } }),
    prisma.payment.groupBy({ by: ["branchId"], where: { paidOn }, _sum: { amount: true } }),
    prisma.expense.groupBy({
      by: ["branchId"],
      where: { spentOn: paidOn },
      _sum: { amount: true },
    }),
  ]);

  const byBranch = new Map(budgets.map((budget) => [budget.branchId, budget]));
  const incomeBy = new Map(income.map((row) => [row.branchId, amount(row._sum.amount)]));
  const expensesBy = new Map(expenses.map((row) => [row.branchId, amount(row._sum.amount)]));

  return branches.map((branch) => {
    const budget = byBranch.get(branch.id);
    const expectedIncome = amount(budget?.expectedIncome);
    const plannedExpenses = sumMoney((budget?.lines ?? []).map((line) => line.amount.toString()));
    const actualIncome = incomeBy.get(branch.id) ?? "0.00";
    const actualExpenses = expensesBy.get(branch.id) ?? "0.00";

    return {
      branchId: branch.id,
      branchName: branch.name,
      planned: Boolean(budget),
      expectedIncome,
      plannedExpenses,
      actualIncome,
      actualExpenses,
      plannedNet: subtractMoney(expectedIncome, plannedExpenses),
      actualNet: subtractMoney(actualIncome, actualExpenses),
    };
  });
}

export type BudgetLine = {
  category: ExpenseCategory;
  planned: string;
  actual: string;
  /** Actual minus planned. Positive means more was spent than planned for. */
  difference: string;
};

/** One branch's plan for one month, with the actual figures beside it. */
export async function branchBudget(branchId: string, month: string) {
  const paidOn = monthRange(month);
  const [branch, budget, income, byCategory] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true } }),
    prisma.monthlyBudget.findUnique({
      where: { branchId_month: { branchId, month: toDbMonth(month) } },
      include: { lines: true, savedBy: { select: { name: true } } },
    }),
    prisma.payment.aggregate({ where: { branchId, paidOn }, _sum: { amount: true } }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { branchId, spentOn: paidOn },
      _sum: { amount: true },
    }),
  ]);
  if (!branch) return null;

  const plannedBy = new Map(
    (budget?.lines ?? []).map((line) => [line.category, line.amount.toString()]),
  );
  const actualBy = new Map(byCategory.map((row) => [row.category, amount(row._sum.amount)]));

  const lines: BudgetLine[] = expenseCategories.map((category) => {
    const planned = amount(plannedBy.get(category));
    const actual = actualBy.get(category) ?? "0.00";
    return { category, planned, actual, difference: subtractMoney(actual, planned) };
  });

  const expectedIncome = amount(budget?.expectedIncome);
  const actualIncome = amount(income._sum.amount);
  const plannedExpenses = sumMoney(lines.map((line) => line.planned));
  const actualExpenses = sumMoney(lines.map((line) => line.actual));

  return {
    branch,
    /** Null until the admin writes a plan for this branch and month. */
    budget,
    lines,
    expectedIncome,
    actualIncome,
    plannedExpenses,
    actualExpenses,
    plannedNet: subtractMoney(expectedIncome, plannedExpenses),
    actualNet: subtractMoney(actualIncome, actualExpenses),
  };
}

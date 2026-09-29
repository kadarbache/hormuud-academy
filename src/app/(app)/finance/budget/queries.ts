import "server-only";
import { monthEnd, monthStart, toDbDate, toDbMonth } from "@/lib/dates";
import { currentRate } from "@/lib/exchange-rate";
import { combinedAt, fromCents, subtractMoney, sumMoney, toCents, totalOf, type LedgerSum } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { listExpenseCategories } from "../expense-categories/queries";
import { ledgerSum } from "../queries";

// The plan for a month, next to what actually happened.
//
// Only the plan is stored. The actual figures are counted from the payments
// and expenses every time the screen is opened, so a payment recorded late
// shows up in last month's comparison the moment it's entered.
//
// A plan is written in dollars, so the actual figures are both currencies
// together in dollars at today's rate, the same combined figures every other
// screen shows.

function monthRange(month: string) {
  return { gte: toDbDate(monthStart(month)), lte: toDbDate(monthEnd(month)) };
}

function amount(value: { toString(): string } | null | undefined) {
  return fromCents(toCents(value?.toString() ?? 0));
}

/** Grouped sums as a map from key to what they come to in dollars at a rate. */
function combinedBy(rows: { key: string; sum: LedgerSum }[], rate: string | null) {
  const sums = new Map<string, LedgerSum[]>();
  for (const row of rows) sums.set(row.key, [...(sums.get(row.key) ?? []), row.sum]);
  return new Map([...sums].map(([key, list]) => [key, combinedAt(totalOf(list), rate)]));
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
  const [branches, budgets, income, expenses, rate] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.monthlyBudget.findMany({ where: { month: toDbMonth(month) }, include: { lines: true } }),
    prisma.payment.groupBy({
      by: ["branchId", "currency"],
      where: { paidOn },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["branchId", "currency"],
      where: { spentOn: paidOn },
      _sum: { amount: true },
    }),
    currentRate(),
  ]);

  const byBranch = new Map(budgets.map((budget) => [budget.branchId, budget]));
  const incomeBy = combinedBy(
    income.map((row) => ({ key: row.branchId, sum: ledgerSum(row) })),
    rate,
  );
  const expensesBy = combinedBy(
    expenses.map((row) => ({ key: row.branchId, sum: ledgerSum(row) })),
    rate,
  );

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
  categoryId: string;
  name: string;
  /** False for a deactivated category, listed because this month planned or spent on it. */
  active: boolean;
  planned: string;
  actual: string;
  /** Actual minus planned. Positive means more was spent than planned for. */
  difference: string;
};

/** One branch's plan for one month, with the actual figures beside it. */
export async function branchBudget(branchId: string, month: string) {
  const paidOn = monthRange(month);
  const [branch, budget, income, byCategory, categories, rate] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true } }),
    prisma.monthlyBudget.findUnique({
      where: { branchId_month: { branchId, month: toDbMonth(month) } },
      include: { lines: true, savedBy: { select: { name: true } } },
    }),
    prisma.payment.groupBy({
      by: ["currency"],
      where: { branchId, paidOn },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["categoryId", "currency"],
      where: { branchId, spentOn: paidOn },
      _sum: { amount: true },
    }),
    listExpenseCategories(),
    currentRate(),
  ]);
  if (!branch) return null;

  const plannedBy = new Map(
    (budget?.lines ?? []).map((line) => [line.categoryId, line.amount.toString()]),
  );
  const actualBy = combinedBy(
    byCategory.map((row) => ({ key: row.categoryId, sum: ledgerSum(row) })),
    rate,
  );

  // Every active category, and a deactivated one only when this month planned
  // or spent something on it.
  const lines: BudgetLine[] = categories
    .filter((category) => category.active || plannedBy.has(category.id) || actualBy.has(category.id))
    .map((category) => {
      const planned = amount(plannedBy.get(category.id));
      const actual = actualBy.get(category.id) ?? "0.00";
      return {
        categoryId: category.id,
        name: category.name,
        active: category.active,
        planned,
        actual,
        difference: subtractMoney(actual, planned),
      };
    });

  const expectedIncome = amount(budget?.expectedIncome);
  const actualIncome = combinedAt(totalOf(income.map(ledgerSum)), rate);
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

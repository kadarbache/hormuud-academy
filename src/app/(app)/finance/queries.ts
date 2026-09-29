import "server-only";
import type { IncomeCategory, PaymentMethod, Prisma } from "@/generated/prisma/client";
import { subtractTotals, toCents, totalOf, type LedgerSum, type MoneyTotal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { listExpenseCategories } from "./expense-categories/queries";
import { incomeCategories, paymentMethods } from "./labels";

// The figures every financial screen is built from. Nothing here stores a
// total: a day's takings are counted from the payments recorded for that day,
// every time they're asked for, so the books and the ledger can't drift apart.
//
// Every sum is split by currency as well as by whatever the screen asks for,
// which keeps dollars and shillings apart. What the two come to together is
// worked out when a figure is shown, at today's rate.

export type Totals<K extends string> = {
  /** Every key, including the ones that took nothing, so tables stay steady. */
  byKey: Record<K, MoneyTotal>;
  total: MoneyTotal;
};

type Summed = {
  currency: LedgerSum["currency"];
  _sum: { amount: LedgerSum["amount"] };
};

/** One grouped row as a ledger sum. */
export function ledgerSum(row: Summed): LedgerSum {
  return { currency: row.currency, amount: row._sum.amount };
}

function collect<K extends string>(
  keys: readonly K[],
  rows: { key: K; sum: LedgerSum }[],
): Totals<K> {
  const byKey = Object.fromEntries(
    keys.map((key) => [
      key,
      totalOf(rows.filter((row) => row.key === key).map((row) => row.sum)),
    ]),
  ) as Record<K, MoneyTotal>;
  return { byKey, total: totalOf(rows.map((row) => row.sum)) };
}

const sums = { amount: true } as const;

export async function incomeByMethod(
  where: Prisma.PaymentWhereInput,
): Promise<Totals<PaymentMethod>> {
  const rows = await prisma.payment.groupBy({ by: ["method", "currency"], where, _sum: sums });
  return collect(
    paymentMethods,
    rows.map((row) => ({ key: row.method, sum: ledgerSum(row) })),
  );
}

export async function incomeByCategory(
  where: Prisma.PaymentWhereInput,
): Promise<Totals<IncomeCategory>> {
  const rows = await prisma.payment.groupBy({ by: ["category", "currency"], where, _sum: sums });
  return collect(
    incomeCategories,
    rows.map((row) => ({ key: row.category, sum: ledgerSum(row) })),
  );
}

export type CategoryRow = { key: string; label: string; amount: MoneyTotal };

/** True when a total holds money in either currency, negative or not. */
export function hasMoney(total: MoneyTotal) {
  return toCents(total.USD) !== 0 || toCents(total.SLSH) !== 0;
}

/**
 * Spending by expense category, as the rows of a breakdown. Every active
 * category is listed, so a zero is visibly a zero. A deactivated one is listed
 * only when money went on it here, so old spending still adds up.
 */
export async function expensesByCategory(
  where: Prisma.ExpenseWhereInput,
): Promise<{ rows: CategoryRow[]; total: MoneyTotal }> {
  const [categories, rows] = await Promise.all([
    listExpenseCategories(),
    prisma.expense.groupBy({ by: ["categoryId", "currency"], where, _sum: sums }),
  ]);
  const { byKey, total } = collect(
    categories.map((category) => category.id),
    rows.map((row) => ({ key: row.categoryId, sum: ledgerSum(row) })),
  );
  return {
    rows: categories
      .filter((category) => category.active || hasMoney(byKey[category.id]))
      .map((category) => ({ key: category.id, label: category.name, amount: byKey[category.id] })),
    total,
  };
}

export async function expensesByMethod(
  where: Prisma.ExpenseWhereInput,
): Promise<Totals<PaymentMethod>> {
  const rows = await prisma.expense.groupBy({ by: ["method", "currency"], where, _sum: sums });
  return collect(
    paymentMethods,
    rows.map((row) => ({ key: row.method, sum: ledgerSum(row) })),
  );
}

export async function totalIncome(where: Prisma.PaymentWhereInput): Promise<MoneyTotal> {
  const rows = await prisma.payment.groupBy({ by: ["currency"], where, _sum: sums });
  return totalOf(rows.map(ledgerSum));
}

export async function totalExpenses(where: Prisma.ExpenseWhereInput): Promise<MoneyTotal> {
  const rows = await prisma.expense.groupBy({ by: ["currency"], where, _sum: sums });
  return totalOf(rows.map(ledgerSum));
}

/**
 * What percentage-paid teachers earned from the payments in this scope. A
 * share is in the currency the student paid.
 */
export async function totalTeacherShare(where: Prisma.PaymentWhereInput): Promise<MoneyTotal> {
  const rows = await prisma.payment.groupBy({
    by: ["currency"],
    where,
    _sum: { teacherShare: true },
  });
  return totalOf(rows.map((row) => ({ currency: row.currency, amount: row._sum.teacherShare })));
}

/** Income minus expenses, currency by currency. Negative when the college spent more than it took. */
export function netBalance(income: MoneyTotal, expenses: MoneyTotal): MoneyTotal {
  return subtractTotals(income, expenses);
}

export function isNegative(amount: string) {
  return toCents(amount) < 0;
}

import "server-only";
import type {
  ExpenseCategory,
  IncomeCategory,
  PaymentMethod,
  Prisma,
} from "@/generated/prisma/client";
import { fromCents, subtractMoney, toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { expenseCategories, incomeCategories, paymentMethods } from "./labels";

// The figures every financial screen is built from. Nothing here stores a
// total: a day's takings are counted from the payments recorded for that day,
// every time they're asked for, so the books and the ledger can't drift apart.

export type Totals<K extends string> = {
  /** Every key, including the ones that took nothing, so tables stay steady. */
  byKey: Record<K, string>;
  total: string;
};

function collect<K extends string>(
  keys: readonly K[],
  rows: { key: K; amount: Prisma.Decimal | null }[],
): Totals<K> {
  const byKey = Object.fromEntries(keys.map((key) => [key, "0.00"])) as Record<K, string>;
  let cents = 0;
  for (const row of rows) {
    const amount = toCents(row.amount?.toString() ?? 0);
    byKey[row.key] = fromCents(amount);
    cents += amount;
  }
  return { byKey, total: fromCents(cents) };
}

export async function incomeByMethod(
  where: Prisma.PaymentWhereInput,
): Promise<Totals<PaymentMethod>> {
  const rows = await prisma.payment.groupBy({ by: ["method"], where, _sum: { amount: true } });
  return collect(
    paymentMethods,
    rows.map((row) => ({ key: row.method, amount: row._sum.amount })),
  );
}

export async function incomeByCategory(
  where: Prisma.PaymentWhereInput,
): Promise<Totals<IncomeCategory>> {
  const rows = await prisma.payment.groupBy({ by: ["category"], where, _sum: { amount: true } });
  return collect(
    incomeCategories,
    rows.map((row) => ({ key: row.category, amount: row._sum.amount })),
  );
}

export async function expensesByCategory(
  where: Prisma.ExpenseWhereInput,
): Promise<Totals<ExpenseCategory>> {
  const rows = await prisma.expense.groupBy({ by: ["category"], where, _sum: { amount: true } });
  return collect(
    expenseCategories,
    rows.map((row) => ({ key: row.category, amount: row._sum.amount })),
  );
}

export async function expensesByMethod(
  where: Prisma.ExpenseWhereInput,
): Promise<Totals<PaymentMethod>> {
  const rows = await prisma.expense.groupBy({ by: ["method"], where, _sum: { amount: true } });
  return collect(
    paymentMethods,
    rows.map((row) => ({ key: row.method, amount: row._sum.amount })),
  );
}

export async function totalIncome(where: Prisma.PaymentWhereInput): Promise<string> {
  const { _sum } = await prisma.payment.aggregate({ where, _sum: { amount: true } });
  return fromCents(toCents(_sum.amount?.toString() ?? 0));
}

export async function totalExpenses(where: Prisma.ExpenseWhereInput): Promise<string> {
  const { _sum } = await prisma.expense.aggregate({ where, _sum: { amount: true } });
  return fromCents(toCents(_sum.amount?.toString() ?? 0));
}

/** What percentage-paid teachers earned from the payments in this scope. */
export async function totalTeacherShare(where: Prisma.PaymentWhereInput): Promise<string> {
  const { _sum } = await prisma.payment.aggregate({ where, _sum: { teacherShare: true } });
  return fromCents(toCents(_sum.teacherShare?.toString() ?? 0));
}

/** Income minus expenses. Negative when the college spent more than it took. */
export function netBalance(income: string, expenses: string): string {
  return subtractMoney(income, expenses);
}

export function isNegative(amount: string) {
  return toCents(amount) < 0;
}

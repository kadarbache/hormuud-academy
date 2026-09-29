"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { Currency } from "@/generated/prisma/client";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { collegeToday, formatMonth, toDbDate, toDbMonth } from "@/lib/dates";
import { currentRate, ledgerFields, NO_RATE_MESSAGE } from "@/lib/exchange-rate";
import { formatMoney } from "@/lib/format";
import { inLedger, isPositiveMoney, subtractMoney, toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import {
  currency,
  formObject,
  isoDate,
  isoMonth,
  moneyIn,
  optionalText,
  paymentMethod,
} from "@/lib/validation";
import { TEACHER_SALARY_ID } from "../labels";
import { paidInSalaryCurrency } from "../teacher-pay/pay";
import { paidForMonth, unpaidShare } from "../teacher-pay/queries";

// Money out. Expenses are the admin's alone: a branch shouldn't be able to
// read what the college pays its rent or its people.
//
// An expense is in dollars or in shillings. A shilling expense keeps the
// exchange rate in force when it was recorded, like a receipt, and keeps it
// when it's edited: correcting the amount works out its dollar value on that
// day again, at that same rate.

const expenseSchema = (currencyValue: string | undefined) =>
  z.object({
    categoryId: z
      .string({ error: "Pick what the money was spent on." })
      .min(1, "Pick what the money was spent on."),
    method: paymentMethod("Pick how it was paid."),
    currency: currency(),
    amount: moneyIn(currencyValue, "Enter the amount spent."),
    spentOn: isoDate("Pick the day it was paid.").refine(
      (value) => value <= collegeToday(),
      "The date can't be in the future.",
    ),
    branchId: z.string({ error: "Pick the branch." }).min(1, "Pick the branch."),
    note: optionalText(200),
  });

/**
 * A teacher's pay always names the teacher and the month it covers, so it can
 * be traced back to them. Everything else leaves both empty.
 */
function readTeacherPay(values: Record<string, string>, categoryId: string) {
  if (categoryId !== TEACHER_SALARY_ID) return { ok: true as const, teacherId: null, forMonth: null };

  const month = isoMonth("Pick the month this pay covers.").safeParse(values.forMonth);
  if (!values.teacherId || !month.success) {
    return {
      ok: false as const,
      errors: {
        ...(values.teacherId ? {} : { teacherId: ["Pick the teacher being paid."] }),
        ...(month.success ? {} : { forMonth: ["Pick the month this pay covers."] }),
      },
    };
  }
  return { ok: true as const, teacherId: values.teacherId, forMonth: month.data };
}

/**
 * A teacher is never paid more than they're due. A percentage teacher can be
 * paid up to their unpaid share in the currency being paid; a fixed teacher
 * up to their monthly salary for the month the pay covers, across every
 * payment made for it. Returns a message for the amount box, or null when
 * it's fine.
 */
async function overpaymentMessage(
  teacher: {
    id: string;
    name: string;
    salaryType: string;
    fixedSalary: { toString(): string } | null;
    salaryCurrency: Currency;
  },
  amount: string,
  paidIn: Currency,
  forMonth: string,
  leaveOut?: string,
): Promise<string | null> {
  if (teacher.salaryType === "PERCENTAGE") {
    const share = await unpaidShare(teacher.id, leaveOut);
    const available = share[paidIn];
    if (toCents(amount) <= toCents(available)) return null;

    const other: Currency = paidIn === "USD" ? "SLSH" : "USD";
    const otherShare = isPositiveMoney(share[other])
      ? ` Their unpaid share in ${other} is ${formatMoney(share[other], other)}.`
      : "";
    return isPositiveMoney(available)
      ? `${teacher.name}'s unpaid share in ${paidIn} is ${formatMoney(available, paidIn)}. Pay that or less.${otherShare}`
      : `${teacher.name} has no unpaid share in ${paidIn}, so there's nothing to pay in it.${otherShare}`;
  }

  const salary = teacher.fixedSalary?.toString() ?? "0";
  const salaryIn = teacher.salaryCurrency;
  if (!isPositiveMoney(salary)) {
    return `${teacher.name} has no monthly salary set. Set it on the Teachers page first.`;
  }
  const [paidSoFar, rate] = await Promise.all([
    paidForMonth(teacher.id, forMonth, leaveOut),
    currentRate(),
  ]);
  const paid = paidInSalaryCurrency(paidSoFar, salaryIn, rate);
  if (toCents(paid) + toCents(amount) <= toCents(salary)) return null;

  const left = subtractMoney(salary, paid);
  return isPositiveMoney(left)
    ? `${teacher.name} has been paid ${formatMoney(paid, salaryIn)} of ${formatMoney(salary, salaryIn)} for ${formatMonth(forMonth)}. Pay ${formatMoney(left, salaryIn)} or less.`
    : `${teacher.name}'s ${formatMoney(salary, salaryIn)} for ${formatMonth(forMonth)} is already paid in full.`;
}

/**
 * `editing` is the expense being changed, so its old amount isn't counted
 * twice, it can stay in a category that has been deactivated since, and a
 * shilling expense keeps the rate it was first recorded at.
 */
async function checkedFields(
  values: Record<string, string>,
  editing?: {
    id: string;
    categoryId: string;
    currency: Currency;
    exchangeRate: { toString(): string } | null;
  },
) {
  const parsed = expenseSchema(values.currency).safeParse(values);
  if (!parsed.success) return { ok: false as const, result: invalid(parsed.error) };
  if (!isPositiveMoney(parsed.data.amount)) {
    return {
      ok: false as const,
      result: failure("Check the highlighted fields.", {
        amount: ["Enter an amount above zero."],
      }),
    };
  }

  const category = await prisma.expenseCategory.findUnique({
    where: { id: parsed.data.categoryId },
  });
  if (!category) return { ok: false as const, result: failure("That category no longer exists.") };
  if (!category.active && category.id !== editing?.categoryId) {
    return {
      ok: false as const,
      result: failure("Check the highlighted fields.", {
        categoryId: [`${category.name} has been deactivated. Pick another category.`],
      }),
    };
  }

  const pay = readTeacherPay(values, category.id);
  if (!pay.ok) return { ok: false as const, result: failure("Check the highlighted fields.", pay.errors) };

  if (!(await prisma.branch.findUnique({ where: { id: parsed.data.branchId } }))) {
    return { ok: false as const, result: failure("That branch no longer exists.") };
  }

  const ledger =
    editing?.currency === "SLSH" && parsed.data.currency === "SLSH" && editing.exchangeRate
      ? { currency: "SLSH" as const, exchangeRate: editing.exchangeRate.toString() }
      : await ledgerFields(parsed.data.currency);
  if (!ledger) {
    return {
      ok: false as const,
      result: failure("Check the highlighted fields.", { currency: [NO_RATE_MESSAGE] }),
    };
  }

  if (pay.teacherId && pay.forMonth) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: pay.teacherId },
      select: { id: true, name: true, salaryType: true, fixedSalary: true, salaryCurrency: true },
    });
    if (!teacher) return { ok: false as const, result: failure("That teacher no longer exists.") };

    // A fixed salary is set in one currency and paid in it.
    if (teacher.salaryType === "FIXED" && parsed.data.currency !== teacher.salaryCurrency) {
      return {
        ok: false as const,
        result: failure("Check the highlighted fields.", {
          currency: [
            `${teacher.name}'s salary is in ${teacher.salaryCurrency}, so pay it in ${teacher.salaryCurrency}.`,
          ],
        }),
      };
    }

    const tooMuch = await overpaymentMessage(
      teacher,
      parsed.data.amount,
      parsed.data.currency,
      pay.forMonth,
      editing?.id,
    );
    if (tooMuch) {
      return {
        ok: false as const,
        result: failure("Check the highlighted fields.", { amount: [tooMuch] }),
      };
    }
  }

  return {
    ok: true as const,
    data: {
      ...parsed.data,
      ...inLedger(parsed.data.amount, ledger),
      spentOn: toDbDate(parsed.data.spentOn),
      teacherId: pay.teacherId,
      forMonth: pay.forMonth ? toDbMonth(pay.forMonth) : null,
    },
    paidFor: pay.forMonth,
    categoryName: category.name,
    amount: formatMoney(parsed.data.amount, parsed.data.currency),
  };
}

export async function createExpense(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const checked = await checkedFields(formObject(formData));
  if (!checked.ok) return checked.result;

  await prisma.expense.create({ data: { ...checked.data, recordedById: user.id } });

  refresh();
  const covers = checked.paidFor ? ` for ${formatMonth(checked.paidFor)}` : "";
  return success(`${checked.categoryName}${covers}: ${checked.amount} recorded.`);
}

export async function updateExpense(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return failure("That expense no longer exists.");

  const checked = await checkedFields(formObject(formData), expense);
  if (!checked.ok) return checked.result;

  await prisma.expense.update({ where: { id }, data: checked.data });

  refresh();
  return success("Expense saved.");
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await requireAdmin();
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return failure("That expense no longer exists.");

  await prisma.expense.delete({ where: { id } });

  refresh();
  return success(
    `${formatMoney(expense.amount.toString(), expense.currency)} removed from the books.`,
  );
}

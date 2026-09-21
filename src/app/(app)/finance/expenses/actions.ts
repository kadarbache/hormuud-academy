"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { collegeToday, formatMonth, toDbDate, toDbMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { isPositiveMoney, subtractMoney, toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import {
  formObject,
  isoDate,
  isoMonth,
  money,
  optionalText,
  paymentMethod,
} from "@/lib/validation";
import { expenseCategoryLabels } from "../labels";
import { paidForMonth, percentageOwed } from "../teacher-pay/queries";

// Money out. Expenses are the admin's alone: a branch shouldn't be able to
// read what the college pays its rent or its people.

const expenseSchema = z.object({
  category: z.enum(
    [
      "RENT",
      "ELECTRICITY",
      "TEACHER_SALARY",
      "STAFF_SALARY",
      "INTERNET",
      "STATIONERY",
      "TRANSPORTATION",
      "MAINTENANCE",
      "OTHER",
    ],
    { error: "Pick what the money was spent on." },
  ),
  method: paymentMethod("Pick how it was paid."),
  amount: money("Enter the amount spent."),
  spentOn: isoDate("Pick the day it was paid.").refine(
    (value) => value <= collegeToday(),
    "The date can't be in the future.",
  ),
  branchId: z.string({ error: "Pick the branch." }).min(1, "Pick the branch."),
  note: optionalText(200),
});

type Parsed = z.infer<typeof expenseSchema>;

/**
 * A teacher's pay always names the teacher and the month it covers, so it can
 * be traced back to them. Everything else leaves both empty.
 */
function readTeacherPay(values: Record<string, string>, category: Parsed["category"]) {
  if (category !== "TEACHER_SALARY") return { ok: true as const, teacherId: null, forMonth: null };

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
 * paid up to what they've earned and not yet been paid; a fixed teacher up to
 * their monthly salary for the month the pay covers, across every payment
 * made for it. Returns a message for the amount box, or null when it's fine.
 */
async function overpaymentMessage(
  teacher: {
    id: string;
    name: string;
    salaryType: string;
    fixedSalary: { toString(): string } | null;
  },
  amount: string,
  forMonth: string,
  leaveOut?: string,
): Promise<string | null> {
  if (teacher.salaryType === "PERCENTAGE") {
    const owed = await percentageOwed(teacher.id, leaveOut);
    if (toCents(amount) <= toCents(owed)) return null;
    return isPositiveMoney(owed)
      ? `${teacher.name} is owed ${formatMoney(owed)}. Pay that or less.`
      : `${teacher.name} isn't owed anything, so there's nothing to pay.`;
  }

  const salary = teacher.fixedSalary?.toString() ?? "0";
  if (!isPositiveMoney(salary)) {
    return `${teacher.name} has no monthly salary set. Set it on the Teachers page first.`;
  }
  const paid = await paidForMonth(teacher.id, forMonth, leaveOut);
  if (toCents(paid) + toCents(amount) <= toCents(salary)) return null;

  const left = subtractMoney(salary, paid);
  return isPositiveMoney(left)
    ? `${teacher.name} has been paid ${formatMoney(paid)} of ${formatMoney(salary)} for ${formatMonth(forMonth)}. Pay ${formatMoney(left)} or less.`
    : `${teacher.name}'s ${formatMoney(salary)} for ${formatMonth(forMonth)} is already paid in full.`;
}

/** `editing` is the expense being changed, so its old amount isn't counted twice. */
async function checkedFields(values: Record<string, string>, editing?: string) {
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) return { ok: false as const, result: invalid(parsed.error) };
  if (!isPositiveMoney(parsed.data.amount)) {
    return {
      ok: false as const,
      result: failure("Check the highlighted fields.", {
        amount: ["Enter an amount above zero."],
      }),
    };
  }

  const pay = readTeacherPay(values, parsed.data.category);
  if (!pay.ok) return { ok: false as const, result: failure("Check the highlighted fields.", pay.errors) };

  if (!(await prisma.branch.findUnique({ where: { id: parsed.data.branchId } }))) {
    return { ok: false as const, result: failure("That branch no longer exists.") };
  }
  if (pay.teacherId && pay.forMonth) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: pay.teacherId },
      select: { id: true, name: true, salaryType: true, fixedSalary: true },
    });
    if (!teacher) return { ok: false as const, result: failure("That teacher no longer exists.") };

    const tooMuch = await overpaymentMessage(teacher, parsed.data.amount, pay.forMonth, editing);
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
      spentOn: toDbDate(parsed.data.spentOn),
      teacherId: pay.teacherId,
      forMonth: pay.forMonth ? toDbMonth(pay.forMonth) : null,
    },
    paidFor: pay.forMonth,
    category: parsed.data.category,
    amount: parsed.data.amount,
  };
}

export async function createExpense(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const checked = await checkedFields(formObject(formData));
  if (!checked.ok) return checked.result;

  await prisma.expense.create({ data: { ...checked.data, recordedById: user.id } });

  refresh();
  const covers = checked.paidFor ? ` for ${formatMonth(checked.paidFor)}` : "";
  return success(
    `${expenseCategoryLabels[checked.category]}${covers}: ${formatMoney(checked.amount)} recorded.`,
  );
}

export async function updateExpense(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!(await prisma.expense.findUnique({ where: { id } }))) {
    return failure("That expense no longer exists.");
  }

  const checked = await checkedFields(formObject(formData), id);
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
  return success(`${formatMoney(expense.amount.toString())} removed from the books.`);
}

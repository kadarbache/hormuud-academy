"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { canActAtBranch } from "@/lib/access";
import {
  failure,
  invalid,
  isUniqueViolation,
  success,
  type ActionResult,
} from "@/lib/action-result";
import {
  collegeToday,
  formatMonth,
  fromDbDate,
  fromDbMonth,
  toCollegeDate,
  toDbDate,
  toDbMonth,
} from "@/lib/dates";
import { ledgerFields, NO_RATE_MESSAGE } from "@/lib/exchange-rate";
import { formatMoney, parseStudentLookup } from "@/lib/format";
import { dollarsToShillings, inLedger, isPositiveMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";
import { teacherShareOf } from "@/lib/teacher-share";
import {
  currency,
  formObject,
  isoDate,
  isoMonth,
  moneyIn,
  optionalText,
  paymentMethod,
} from "@/lib/validation";
import { feeMonths } from "../fee-months";
import { TEACHER_SALARY_ID, walkInIncomeCategories } from "../labels";

// Recording money in. Every screen that takes a payment ends up here, so the
// branch check and the teacher's share are worked out the same way whether
// the payment is a registration fee, a month of a skill, or a book sold over
// the counter.
//
// A payment is in dollars or in shillings, whichever the student handed over.
// A shilling payment keeps the exchange rate in force as it's recorded, and
// can't be recorded at all until the admin has set one.

const paidOnField = isoDate("Pick the day the money came in.").refine(
  (value) => value <= collegeToday(),
  "The payment date can't be in the future.",
);

const noRate = () => failure("Check the highlighted fields.", { currency: [NO_RATE_MESSAGE] });

/** An enrollment with everything a payment for it needs to know. */
function findEnrollment(id: string) {
  return prisma.enrollment.findUnique({
    where: { id },
    include: {
      skill: { select: { name: true } },
      branchSkill: { select: { branchId: true } },
      // The teacher of the student's class time earns any share of the fee.
      classTime: {
        select: { teacher: { select: { id: true, salaryType: true, percentageRate: true } } },
      },
    },
  });
}

export async function recordRegistrationFee(
  enrollmentId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z
    .object({ paidOn: paidOnField, method: paymentMethod(), currency: currency() })
    .safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const enrollment = await findEnrollment(enrollmentId);
  if (!enrollment) return failure("That skill record no longer exists.");
  if (!canActAtBranch(user, enrollment.branchSkill.branchId)) {
    return failure("Only staff at the skill's branch can record its payments.");
  }
  const fee = enrollment.registrationFee.toString();
  if (!isPositiveMoney(fee)) {
    return failure("This skill has no registration fee to pay.");
  }

  const ledger = await ledgerFields(parsed.data.currency);
  if (!ledger) return noRate();
  // The fee is set in dollars. Paid in shillings, it's the fee at the rate in
  // force, to the nearest shilling.
  const amount = ledger.exchangeRate ? dollarsToShillings(fee, ledger.exchangeRate) : fee;

  try {
    await prisma.payment.create({
      data: {
        category: "REGISTRATION_FEE",
        method: parsed.data.method,
        ...inLedger(amount, ledger),
        paidOn: toDbDate(parsed.data.paidOn),
        branchId: enrollment.branchSkill.branchId,
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        recordedById: user.id,
      },
    });
  } catch (error) {
    // One registration fee per enrollment, enforced by the database, so two
    // clicks can't charge the student twice.
    if (isUniqueViolation(error)) {
      return failure("This registration fee is already paid. Reload the page to see it.");
    }
    throw error;
  }

  refresh();
  const inShillings = ledger.exchangeRate ? ` (${formatMoney(amount, "SLSH")})` : "";
  return success(`${enrollment.skill.name} registration fee recorded as paid${inShillings}.`);
}

export async function recordMonthlyFee(
  enrollmentId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const values = formObject(formData);
  const parsed = z
    .object({
      month: isoMonth("Pick the month this pays for."),
      currency: currency(),
      amount: moneyIn(values.currency, "Enter the amount paid."),
      paidOn: paidOnField,
      method: paymentMethod(),
    })
    .safeParse(values);
  if (!parsed.success) return invalid(parsed.error);

  const enrollment = await findEnrollment(enrollmentId);
  if (!enrollment) return failure("That skill record no longer exists.");
  if (!canActAtBranch(user, enrollment.branchSkill.branchId)) {
    return failure("Only staff at the skill's branch can record its payments.");
  }
  if (!isPositiveMoney(parsed.data.amount)) {
    return failure("Check the highlighted fields.", { amount: ["Enter an amount above zero."] });
  }

  if (!isPositiveMoney(enrollment.monthlyFee.toString())) {
    return failure(`${enrollment.skill.name} is free, so there's no monthly fee to pay.`);
  }

  // A month the student was never taking the skill in isn't theirs to pay.
  const owed = feeMonths(
    {
      monthlyFee: enrollment.monthlyFee.toString(),
      startDate: fromDbDate(enrollment.startDate),
      endDate: fromDbDate(enrollment.endDate),
      status: enrollment.status,
      statusChangedOn: enrollment.statusChangedAt
        ? toCollegeDate(enrollment.statusChangedAt)
        : null,
    },
    collegeToday(),
  );
  if (!owed.includes(parsed.data.month)) {
    return failure("Check the highlighted fields.", {
      month: [`${enrollment.skill.name} doesn't run in ${formatMonth(parsed.data.month)}.`],
    });
  }

  const ledger = await ledgerFields(parsed.data.currency);
  if (!ledger) return noRate();
  const share = teacherShareOf(parsed.data.amount, ledger, enrollment.classTime.teacher);

  try {
    await prisma.payment.create({
      data: {
        category: "MONTHLY_FEE",
        method: parsed.data.method,
        ...inLedger(parsed.data.amount, ledger),
        paidOn: toDbDate(parsed.data.paidOn),
        forMonth: toDbMonth(parsed.data.month),
        branchId: enrollment.branchSkill.branchId,
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        recordedById: user.id,
        ...share,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure(
        `${formatMonth(parsed.data.month)} is already paid for ${enrollment.skill.name}. Reload the page to see it.`,
      );
    }
    throw error;
  }

  refresh();
  const earned = share.teacherShare
    ? ` The teacher earned ${formatMoney(share.teacherShare, parsed.data.currency)}.`
    : "";
  return success(
    `${formatMonth(parsed.data.month)} recorded for ${enrollment.skill.name}.${earned}`,
  );
}

/**
 * Income that isn't a fee: books, examination fees and anything else taken
 * over the counter. A student can be named so it shows on their record, but
 * a sale to somebody walking in doesn't need one.
 */
export async function recordIncome(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const values = formObject(formData);
  const parsed = z
    .object({
      category: z.enum(walkInIncomeCategories, { error: "Pick what the money was for." }),
      currency: currency(),
      amount: moneyIn(values.currency, "Enter the amount received."),
      paidOn: paidOnField,
      method: paymentMethod(),
      note: optionalText(200),
    })
    .safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  if (!isPositiveMoney(parsed.data.amount)) {
    return failure("Check the highlighted fields.", { amount: ["Enter an amount above zero."] });
  }

  const branchId = user.role === "admin" ? values.branchId : user.branchId;
  if (!branchId) {
    return failure("Check the highlighted fields.", {
      branchId: ["Pick the branch that took the money."],
    });
  }
  if (!canActAtBranch(user, branchId)) {
    return failure("You can only record income at your own branch.");
  }
  if (!(await prisma.branch.findUnique({ where: { id: branchId } }))) {
    return failure("That branch no longer exists.");
  }

  // The student is optional, and given by ID the way staff already look one up.
  let studentId: string | null = null;
  if (values.student?.trim()) {
    const lookup = parseStudentLookup(values.student);
    const student =
      lookup.kind === "number"
        ? await prisma.student.findUnique({ where: { number: lookup.number } })
        : null;
    if (!student) {
      return failure("Check the highlighted fields.", {
        student: ["Enter a student ID like STU-00042, or leave it empty."],
      });
    }
    studentId = student.id;
  }

  const ledger = await ledgerFields(parsed.data.currency);
  if (!ledger) return noRate();

  await prisma.payment.create({
    data: {
      category: parsed.data.category,
      method: parsed.data.method,
      ...inLedger(parsed.data.amount, ledger),
      paidOn: toDbDate(parsed.data.paidOn),
      branchId,
      studentId,
      note: parsed.data.note,
      recordedById: user.id,
    },
  });

  refresh();
  return success(`${formatMoney(parsed.data.amount, parsed.data.currency)} recorded.`);
}

/**
 * Takes a payment back out of the books. Only the admin can, and only for
 * money recorded by mistake: the day's income changes when they do, and so
 * does the share it earned a teacher. A refund is refused once that teacher
 * has been paid for the month, so a teacher is never left owing the college.
 */
export async function deletePayment(id: string): Promise<ActionResult> {
  await requireAdmin();
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      enrollment: { select: { skill: { select: { name: true } } } },
      teacher: { select: { name: true } },
    },
  });
  if (!payment) return failure("That payment no longer exists.");

  // Teachers are paid at the end of the month, so once one has been paid for
  // the month a payment was taken in, the share it earned them has gone out
  // and the college doesn't take that money back.
  if (payment.teacherId) {
    const month = fromDbMonth(payment.paidOn);
    const paid = await prisma.expense.findFirst({
      where: {
        categoryId: TEACHER_SALARY_ID,
        teacherId: payment.teacherId,
        forMonth: toDbMonth(month),
      },
      select: { id: true },
    });
    if (paid) {
      return failure(
        `${payment.teacher?.name ?? "The teacher"} has already been paid for ${formatMonth(month)}, so this payment can't be removed.`,
      );
    }
  }

  await prisma.payment.delete({ where: { id } });
  refresh();

  const skillName = payment.enrollment?.skill.name;
  if (payment.category === "REGISTRATION_FEE") {
    return success(`${skillName ?? "The"} registration fee is unpaid again.`);
  }
  if (payment.category === "MONTHLY_FEE" && payment.forMonth) {
    return success(
      `${formatMonth(fromDbMonth(payment.forMonth))} is unpaid again for ${skillName ?? "the skill"}.`,
    );
  }
  return success(
    `${formatMoney(payment.amount.toString(), payment.currency)} removed from the books.`,
  );
}

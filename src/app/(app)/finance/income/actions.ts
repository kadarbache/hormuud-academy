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
  type FieldErrors,
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
import { dollarsToShillings, fromCents, inLedger, isPositiveMoney, toCents } from "@/lib/money";
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
import { books, copies } from "../../books/labels";
import { feeMonths } from "../fee-months";
import { TEACHER_SALARY_ID, walkInIncomeCategories } from "../labels";
import { bookField, LINE_FIELD, quantityField } from "./book-sale-fields";

// Recording money in. Every screen that takes a payment ends up here, so the
// branch check and the teacher's share are worked out the same way whether
// the payment is a registration fee, a month of a skill, or books sold over
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

/**
 * The student money taken at the counter is for, by student ID: the one the
 * student picker sends, or a whole ID typed without picking. Left empty, it's
 * nobody: a sale to somebody walking in doesn't need one. A name typed
 * without picking is refused rather than quietly dropped.
 */
async function lookUpStudent(
  value: string | undefined,
): Promise<{ studentId: string | null } | { error: ActionResult<never> }> {
  if (!value?.trim()) return { studentId: null };
  const lookup = parseStudentLookup(value);
  const student =
    lookup.kind === "number"
      ? await prisma.student.findUnique({ where: { number: lookup.number } })
      : null;
  if (!student) {
    return {
      error: failure("Check the highlighted fields.", {
        student: [
          lookup.kind === "number"
            ? "No student has that ID."
            : "Pick the student from the list, or clear the box.",
        ],
      }),
    };
  }
  return { studentId: student.id };
}

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
  const values = formObject(formData);
  const parsed = z
    .object({
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
  const fee = enrollment.registrationFee.toString();
  if (!isPositiveMoney(fee)) {
    return failure("This skill has no registration fee to pay.");
  }
  if (!isPositiveMoney(parsed.data.amount)) {
    return failure("Check the highlighted fields.", { amount: ["Enter an amount above zero."] });
  }

  const ledger = await ledgerFields(parsed.data.currency);
  if (!ledger) return noRate();
  // The fee is set in dollars. In shillings, the whole of it is the fee at the
  // rate in force, to the nearest shilling. A student can pay less than that,
  // never more, and whatever is recorded settles the fee.
  const { amount } = parsed.data;
  const fullFee = ledger.exchangeRate ? dollarsToShillings(fee, ledger.exchangeRate) : fee;
  if (toCents(amount) > toCents(fullFee)) {
    return failure("Check the highlighted fields.", {
      amount: [`That's more than the fee, ${formatMoney(fullFee, ledger.currency)}.`],
    });
  }

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
  if (toCents(amount) < toCents(fullFee)) {
    return success(
      `${enrollment.skill.name} registration fee recorded as paid: ${formatMoney(amount, ledger.currency)} of ${formatMoney(fullFee, ledger.currency)}.`,
    );
  }
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
 * Income that isn't a fee or a book sale: examination fees and anything else
 * taken over the counter. A student can be named so it shows on their
 * record, but somebody walking in doesn't need to be.
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

  const student = await lookUpStudent(values.student);
  if ("error" in student) return student.error;

  const ledger = await ledgerFields(parsed.data.currency);
  if (!ledger) return noRate();

  await prisma.payment.create({
    data: {
      category: parsed.data.category,
      method: parsed.data.method,
      ...inLedger(parsed.data.amount, ledger),
      paidOn: toDbDate(parsed.data.paidOn),
      branchId,
      studentId: student.studentId,
      note: parsed.data.note,
      recordedById: user.id,
    },
  });

  refresh();
  return success(`${formatMoney(parsed.data.amount, parsed.data.currency)} recorded.`);
}

/** Thrown inside a sale's transaction to undo it when a book ran out meanwhile. */
class SoldOut extends Error {
  constructor(readonly title: string) {
    super(`${title} ran out.`);
  }
}

/**
 * Books sold over the counter: one or more titles on one receipt, each at
 * the branch's price and with how many copies. The copies come off the
 * branch's shelf in the same write that records the payment, and the
 * database refuses a shelf below zero, so two people can't both sell the
 * last copy. As with a fee, the amount can be lowered for a discount, never
 * raised past what the books come to.
 */
export async function sellBooks(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const values = formObject(formData);
  const parsed = z
    .object({
      currency: currency(),
      amount: moneyIn(values.currency, "Enter the amount received."),
      paidOn: paidOnField,
      method: paymentMethod(),
      note: optionalText(200),
    })
    .safeParse(values);

  // Every row needs a book and a whole number of copies. A title on two rows
  // is sold as one.
  const fieldErrors: FieldErrors = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
  const wanted = new Map<string, { key: string; quantity: number }>();
  const keys = formData.getAll(LINE_FIELD).map(String);
  if (keys.length === 0) fieldErrors.lines = ["Add at least one book."];
  for (const key of keys) {
    const bookId = values[bookField(key)] ?? "";
    const typed = (values[quantityField(key)] ?? "").trim();
    const quantity = /^\d{1,4}$/.test(typed) ? Number(typed) : 0;
    if (!bookId) fieldErrors[bookField(key)] = ["Pick a book, or remove this row."];
    if (quantity < 1) fieldErrors[quantityField(key)] = ["Enter how many copies, 1 or more."];
    if (bookId && quantity >= 1) {
      const earlier = wanted.get(bookId);
      wanted.set(bookId, { key: earlier?.key ?? key, quantity: (earlier?.quantity ?? 0) + quantity });
    }
  }

  const branchId = user.role === "admin" ? values.branchId : user.branchId;
  if (!branchId) fieldErrors.branchId = ["Pick the branch selling them."];
  if (!parsed.success || !branchId || Object.keys(fieldErrors).length > 0) {
    return failure("Check the highlighted fields.", fieldErrors);
  }
  if (!canActAtBranch(user, branchId)) {
    return failure("You can only sell books at your own branch.");
  }
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch?.active) return failure("That branch isn't active. Pick another one.");

  const shelves = await prisma.branchBook.findMany({
    where: { id: { in: [...wanted.keys()] } },
    include: { book: { select: { title: true, active: true } } },
  });
  const lines: { shelf: (typeof shelves)[number]; quantity: number }[] = [];
  for (const [id, { key, quantity }] of wanted) {
    const shelf = shelves.find((candidate) => candidate.id === id);
    if (!shelf || shelf.branchId !== branchId) {
      return failure("One of the books isn't sold at this branch. Reload the page and pick again.");
    }
    if (!shelf.active || !shelf.book.active) {
      fieldErrors[bookField(key)] = [`${shelf.book.title} isn't on sale here any more.`];
    } else if (shelf.stock < quantity) {
      fieldErrors[quantityField(key)] = [
        shelf.stock === 0
          ? `${shelf.book.title} has no copies left.`
          : `Only ${copies(shelf.stock)} left.`,
      ];
    }
    lines.push({ shelf, quantity });
  }
  if (Object.keys(fieldErrors).length > 0) {
    return failure("Check the highlighted fields.", fieldErrors);
  }

  const ledger = await ledgerFields(parsed.data.currency);
  if (!ledger) return noRate();
  // The books' prices are in dollars. In shillings, the whole of it is that
  // at the rate in force, to the nearest shilling.
  const listPrice = fromCents(
    lines.reduce((cents, line) => cents + toCents(line.shelf.price.toString()) * line.quantity, 0),
  );
  const fullAmount = ledger.exchangeRate ? dollarsToShillings(listPrice, ledger.exchangeRate) : listPrice;
  const { amount } = parsed.data;
  if (!isPositiveMoney(amount)) {
    return failure("Check the highlighted fields.", { amount: ["Enter an amount above zero."] });
  }
  if (toCents(amount) > toCents(fullAmount)) {
    return failure("Check the highlighted fields.", {
      amount: [`That's more than the books come to, ${formatMoney(fullAmount, ledger.currency)}.`],
    });
  }

  const student = await lookUpStudent(values.student);
  if ("error" in student) return student.error;

  try {
    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const taken = await tx.branchBook.updateMany({
          where: { id: line.shelf.id, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (taken.count === 0) throw new SoldOut(line.shelf.book.title);
      }
      await tx.payment.create({
        data: {
          category: "BOOKS",
          method: parsed.data.method,
          ...inLedger(amount, ledger),
          paidOn: toDbDate(parsed.data.paidOn),
          branchId,
          studentId: student.studentId,
          note: parsed.data.note,
          recordedById: user.id,
          bookLines: {
            create: lines.map((line) => ({
              branchBookId: line.shelf.id,
              quantity: line.quantity,
              unitPrice: line.shelf.price,
            })),
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof SoldOut) {
      return failure(
        `${error.title} ran out while you were filling this in. Close this and check what's left.`,
      );
    }
    throw error;
  }

  refresh();
  const sold = books(lines.reduce((count, line) => count + line.quantity, 0));
  const discount =
    toCents(amount) < toCents(fullAmount) ? ` instead of ${formatMoney(fullAmount, ledger.currency)}` : "";
  return success(`${sold} sold for ${formatMoney(amount, ledger.currency)}${discount}.`);
}

/**
 * Takes a payment back out of the books. Only the admin can, and only for
 * money recorded by mistake: the day's income changes when they do, and so
 * does the share it earned a teacher. A refund is refused once that teacher
 * has been paid for the month, so a teacher is never left owing the college.
 * The copies a book sale took go back on the branch's shelf.
 */
export async function deletePayment(id: string): Promise<ActionResult> {
  await requireAdmin();
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      enrollment: { select: { skill: { select: { name: true } } } },
      teacher: { select: { name: true } },
      bookLines: { select: { branchBookId: true, quantity: true } },
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

  await prisma.$transaction([
    ...payment.bookLines.map((line) =>
      prisma.branchBook.update({
        where: { id: line.branchBookId },
        data: { stock: { increment: line.quantity } },
      }),
    ),
    prisma.payment.delete({ where: { id } }),
  ]);
  refresh();

  if (payment.bookLines.length > 0) {
    const returned = payment.bookLines.reduce((count, line) => count + line.quantity, 0);
    return success(
      `${formatMoney(payment.amount.toString(), payment.currency)} removed, and ${copies(returned)} back on the shelf.`,
    );
  }
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

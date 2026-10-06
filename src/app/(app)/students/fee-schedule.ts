import type { Currency, EnrollmentStatus, IncomeCategory, Prisma } from "@/generated/prisma/client";
import { fromDbDate, fromDbMonth, toCollegeDate } from "@/lib/dates";
import { isPositiveMoney, sumMoney } from "@/lib/money";
import { feeMonths } from "../finance/fee-months";

/** The parts of a fee payment the schedule reads. */
type FeePayment = {
  category: IncomeCategory;
  forMonth: Date | null;
  amount: Prisma.Decimal;
  currency: Currency;
};

/** The parts of an enrollment the schedule reads, with every fee paid for it. */
type BilledEnrollment = {
  monthlyFee: Prisma.Decimal;
  registrationFee: Prisma.Decimal;
  startDate: Date;
  endDate: Date;
  status: EnrollmentStatus;
  statusChangedAt: Date | null;
  payments: FeePayment[];
};

/**
 * Every month each enrollment owes a fee for, against what has been paid,
 * and what the student owes altogether: unpaid registration fees and unpaid
 * months, at the fees they joined at. The student's page and the portal both
 * show this, so staff and the student see the same figures.
 */
export function feeSchedule<E extends BilledEnrollment>(enrollments: E[], today: string) {
  const rows = enrollments.map((enrollment) => {
    // Typed as the caller's payments, so a page can show more of each one.
    const paidByMonth = new Map<string, E["payments"][number]>(
      enrollment.payments
        .filter((payment) => payment.category === "MONTHLY_FEE" && payment.forMonth)
        .map((payment) => [fromDbMonth(payment.forMonth as Date), payment]),
    );
    const months = feeMonths(
      {
        monthlyFee: enrollment.monthlyFee.toString(),
        startDate: fromDbDate(enrollment.startDate),
        endDate: fromDbDate(enrollment.endDate),
        status: enrollment.status,
        statusChangedOn: enrollment.statusChangedAt
          ? toCollegeDate(enrollment.statusChangedAt)
          : null,
      },
      today,
    ).map((month) => ({ month, payment: paidByMonth.get(month) }));

    const unpaidMonths = months.filter((row) => !row.payment);
    const paid = [...paidByMonth.values()];
    return {
      enrollment,
      // A free skill has no fee months, so it has no place in Monthly fees.
      free: !isPositiveMoney(enrollment.monthlyFee.toString()),
      months,
      paidCount: months.length - unpaidMonths.length,
      // What's still owed is the fee they joined at, once per unpaid month.
      owed: sumMoney(unpaidMonths.map(() => enrollment.monthlyFee.toString())),
      // Kept per currency: dollars and shillings are never added together.
      collected: {
        USD: sumMoney(paid.filter((p) => p.currency === "USD").map((p) => p.amount.toString())),
        SLSH: sumMoney(paid.filter((p) => p.currency === "SLSH").map((p) => p.amount.toString())),
      },
    };
  });

  const registrationOwed = sumMoney(
    enrollments
      .filter(
        (enrollment) =>
          Number(enrollment.registrationFee) > 0 &&
          !enrollment.payments.some((payment) => payment.category === "REGISTRATION_FEE"),
      )
      .map((enrollment) => enrollment.registrationFee.toString()),
  );

  return {
    rows,
    owedAltogether: sumMoney([registrationOwed, ...rows.map((row) => row.owed)]),
  };
}

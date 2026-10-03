import "server-only";
import type { Currency, Prisma } from "@/generated/prisma/client";
import { inUse } from "@/lib/clashes";
import { monthEnd, monthStart, toDbDate, toDbMonth } from "@/lib/dates";
import { subtractTotals, totalOf, ZERO_TOTAL, type LedgerSum, type MoneyTotal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { TEACHER_SALARY_ID } from "../labels";
import { ledgerSum } from "../queries";

// What each teacher has earned and what they have been paid.
//
// Nothing here is stored as a running total. A percentage teacher's earnings
// are the shares written on the payments their students made, added up, and
// their unpaid share is that minus the salary expenses paid to them. So the
// three figures can never drift apart, and removing a payment recorded by
// mistake takes its share back out on its own.
//
// Every figure is kept per currency. A share is earned in the currency the
// student paid, so a teacher can be owed dollars and shillings at once, and
// each is paid out of its own ledger.

/** Sums per teacher, as a map from teacher id to a total in both currencies. */
function totalsByTeacher(rows: { teacherId: string | null; sum: LedgerSum }[]) {
  const sums = new Map<string, LedgerSum[]>();
  for (const row of rows) {
    if (!row.teacherId) continue;
    sums.set(row.teacherId, [...(sums.get(row.teacherId) ?? []), row.sum]);
  }
  return new Map([...sums].map(([teacherId, list]) => [teacherId, totalOf(list)]));
}

/** A grouped row of shares as a ledger sum. */
function shareSum(row: {
  currency: LedgerSum["currency"];
  _sum: { teacherShare: LedgerSum["amount"] };
}): LedgerSum {
  return { currency: row.currency, amount: row._sum.teacherShare };
}

const shareSums = { teacherShare: true } as const;

async function shareTotals(where: Prisma.PaymentWhereInput) {
  const rows = await prisma.payment.groupBy({
    by: ["teacherId", "currency"],
    where: { ...where, teacherId: { not: null } },
    _sum: shareSums,
  });
  return totalsByTeacher(rows.map((row) => ({ teacherId: row.teacherId, sum: shareSum(row) })));
}

async function payoutTotals(where: Prisma.ExpenseWhereInput) {
  const rows = await prisma.expense.groupBy({
    by: ["teacherId", "currency"],
    where: { ...where, categoryId: TEACHER_SALARY_ID, teacherId: { not: null } },
    _sum: { amount: true },
  });
  return totalsByTeacher(rows.map((row) => ({ teacherId: row.teacherId, sum: ledgerSum(row) })));
}

function monthRange(month: string) {
  return { gte: toDbDate(monthStart(month)), lte: toDbDate(monthEnd(month)) };
}

export type TeacherPayRow = {
  id: string;
  name: string;
  active: boolean;
  salaryType: "FIXED" | "PERCENTAGE";
  /** The monthly amount a fixed-salary teacher is due, in salaryCurrency. "0.00" if unset. */
  fixedSalary: string;
  salaryCurrency: Currency;
  /** A percentage teacher's rate, like "30". Empty for a fixed teacher. */
  percentageRate: string;
  branchNames: string[];
  skillNames: string[];
  /** Shares earned from every payment ever recorded. */
  earnedEver: MoneyTotal;
  /** Shares earned from the payments taken in the chosen month. */
  earnedInMonth: MoneyTotal;
  /** Salary and payouts paid to them, ever. */
  paidEver: MoneyTotal;
  /** Salary and payouts paid to them for the chosen month. */
  paidForMonth: MoneyTotal;
  /** Earned but not yet paid out, currency by currency. Percentage teachers only. */
  unpaidShare: MoneyTotal;
};

export async function listTeacherPay(month: string): Promise<TeacherPayRow[]> {
  const [teachers, earnedEver, earnedInMonth, paidEver, paidForMonth] = await Promise.all([
    prisma.teacher.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        branches: { include: { branch: { select: { name: true } } } },
        classTimes: {
          where: inUse,
          select: { branchSkill: { select: { skill: { select: { name: true } } } } },
        },
      },
    }),
    shareTotals({}),
    shareTotals({ paidOn: monthRange(month) }),
    payoutTotals({}),
    // A salary is filed under the month it covers, not the day it was handed
    // over: September's pay is September's whether it went out late or early.
    payoutTotals({ forMonth: toDbMonth(month) }),
  ]);

  return teachers.map((teacher) => {
    const earned = earnedEver.get(teacher.id) ?? ZERO_TOTAL;
    const paid = paidEver.get(teacher.id) ?? ZERO_TOTAL;
    return {
      id: teacher.id,
      name: teacher.name,
      active: teacher.active,
      salaryType: teacher.salaryType,
      fixedSalary: teacher.fixedSalary?.toString() ?? "0.00",
      salaryCurrency: teacher.salaryCurrency,
      percentageRate: teacher.percentageRate?.toString() ?? "",
      branchNames: teacher.branches.map((link) => link.branch.name),
      // A teacher with two class times of one skill teaches it once.
      skillNames: [
        ...new Set(teacher.classTimes.map((classTime) => classTime.branchSkill.skill.name)),
      ].sort(),
      earnedEver: earned,
      earnedInMonth: earnedInMonth.get(teacher.id) ?? ZERO_TOTAL,
      paidEver: paid,
      paidForMonth: paidForMonth.get(teacher.id) ?? ZERO_TOTAL,
      unpaidShare: teacher.salaryType === "PERCENTAGE" ? subtractTotals(earned, paid) : ZERO_TOTAL,
    };
  });
}

/** One teacher, with the payments that earned them a share and their pay so far. */
export async function getTeacherPay(id: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      branches: { include: { branch: { select: { id: true, name: true } } } },
    },
  });
  if (!teacher) return null;

  const [earningsByBranch, branches, payments, payouts, earnedEver, paidEver] = await Promise.all([
    prisma.payment.groupBy({
      by: ["branchId", "currency"],
      where: { teacherId: id },
      _sum: shareSums,
    }),
    prisma.branch.findMany({ select: { id: true, name: true } }),
    prisma.payment.findMany({
      where: { teacherId: id },
      orderBy: [{ paidOn: "desc" }, { number: "desc" }],
      take: 100,
      include: {
        branch: { select: { name: true } },
        student: { select: { id: true, number: true, fullName: true } },
        enrollment: { select: { skill: { select: { name: true } } } },
      },
    }),
    prisma.expense.findMany({
      where: { teacherId: id, categoryId: TEACHER_SALARY_ID },
      orderBy: [{ spentOn: "desc" }, { number: "desc" }],
      include: { branch: { select: { name: true } }, recordedBy: { select: { name: true } } },
    }),
    shareTotals({ teacherId: id }),
    payoutTotals({ teacherId: id }),
  ]);

  // Earnings can come from a branch the teacher has since stopped working at,
  // so the names come from the branches themselves, not their current links.
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const earned = earnedEver.get(id) ?? ZERO_TOTAL;
  const paid = paidEver.get(id) ?? ZERO_TOTAL;

  const byBranch = new Map<string, LedgerSum[]>();
  for (const row of earningsByBranch) {
    byBranch.set(row.branchId, [...(byBranch.get(row.branchId) ?? []), shareSum(row)]);
  }

  return {
    teacher,
    payments,
    payouts,
    earnedEver: earned,
    paidEver: paid,
    unpaidShare: subtractTotals(earned, paid),
    earningsByBranch: [...byBranch].map(([branchId, sums]) => ({
      branchId,
      branchName: branchNames.get(branchId) ?? "A closed branch",
      amount: totalOf(sums),
    })),
  };
}

/**
 * A percentage teacher's unpaid share right now, in each currency: everything
 * they've earned minus everything paid to them. Pass the payout being edited
 * to leave it out, so changing an amount is checked against the share before
 * it was paid.
 */
export async function unpaidShare(teacherId: string, leaveOut?: string): Promise<MoneyTotal> {
  const [earned, paid] = await Promise.all([
    shareTotals({ teacherId }),
    payoutTotals({ teacherId, ...(leaveOut ? { id: { not: leaveOut } } : {}) }),
  ]);
  return subtractTotals(earned.get(teacherId) ?? ZERO_TOTAL, paid.get(teacherId) ?? ZERO_TOTAL);
}

/** What a teacher has been paid for one month, in each currency, leaving out the payout being edited. */
export async function paidForMonth(
  teacherId: string,
  month: string,
  leaveOut?: string,
): Promise<MoneyTotal> {
  const paid = await payoutTotals({
    teacherId,
    forMonth: toDbMonth(month),
    ...(leaveOut ? { id: { not: leaveOut } } : {}),
  });
  return paid.get(teacherId) ?? ZERO_TOTAL;
}

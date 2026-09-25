import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { monthEnd, monthStart, toDbDate, toDbMonth } from "@/lib/dates";
import { fromCents, subtractMoney, toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { TEACHER_SALARY_ID } from "../labels";

// What each teacher has earned and what they have been paid.
//
// Nothing here is stored as a running total. A percentage teacher's earnings
// are the shares written on the payments their students made, added up, and
// what they are owed is that minus the salary expenses paid to them. So the
// three figures can never drift apart, and removing a payment recorded by
// mistake takes its share back out on its own.

/** Sums a money column per teacher, as a map from teacher id to an amount. */
function sumByTeacher(
  rows: { teacherId: string | null; total: Prisma.Decimal | null }[],
): Map<string, string> {
  const totals = new Map<string, string>();
  for (const row of rows) {
    if (row.teacherId) totals.set(row.teacherId, fromCents(toCents(row.total?.toString() ?? 0)));
  }
  return totals;
}

async function shareTotals(where: Prisma.PaymentWhereInput) {
  const rows = await prisma.payment.groupBy({
    by: ["teacherId"],
    where: { ...where, teacherId: { not: null } },
    _sum: { teacherShare: true },
  });
  return sumByTeacher(rows.map((row) => ({ teacherId: row.teacherId, total: row._sum.teacherShare })));
}

async function payoutTotals(where: Prisma.ExpenseWhereInput) {
  const rows = await prisma.expense.groupBy({
    by: ["teacherId"],
    where: { ...where, categoryId: TEACHER_SALARY_ID, teacherId: { not: null } },
    _sum: { amount: true },
  });
  return sumByTeacher(rows.map((row) => ({ teacherId: row.teacherId, total: row._sum.amount })));
}

function monthRange(month: string) {
  return { gte: toDbDate(monthStart(month)), lte: toDbDate(monthEnd(month)) };
}

export type TeacherPayRow = {
  id: string;
  name: string;
  active: boolean;
  salaryType: "FIXED" | "PERCENTAGE";
  /** The monthly amount a fixed-salary teacher is due. "0.00" if unset. */
  fixedSalary: string;
  /** A percentage teacher's rate, like "30". Empty for a fixed teacher. */
  percentageRate: string;
  branchNames: string[];
  skillNames: string[];
  /** Shares earned from every payment ever recorded. */
  earnedEver: string;
  /** Shares earned from the payments taken in the chosen month. */
  earnedInMonth: string;
  /** Salary and payouts paid to them, ever. */
  paidEver: string;
  /** Salary and payouts paid to them for the chosen month. */
  paidForMonth: string;
  /** Earned but not yet paid out. Percentage teachers only. */
  owed: string;
};

export async function listTeacherPay(month: string): Promise<TeacherPayRow[]> {
  const [teachers, earnedEver, earnedInMonth, paidEver, paidForMonth] = await Promise.all([
    prisma.teacher.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        branches: { include: { branch: { select: { name: true } } } },
        branchSkills: { include: { skill: { select: { name: true } } } },
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
    const earned = earnedEver.get(teacher.id) ?? "0.00";
    const paid = paidEver.get(teacher.id) ?? "0.00";
    return {
      id: teacher.id,
      name: teacher.name,
      active: teacher.active,
      salaryType: teacher.salaryType,
      fixedSalary: teacher.fixedSalary?.toString() ?? "0.00",
      percentageRate: teacher.percentageRate?.toString() ?? "",
      branchNames: teacher.branches.map((link) => link.branch.name),
      skillNames: teacher.branchSkills.map((bs) => bs.skill.name),
      earnedEver: earned,
      earnedInMonth: earnedInMonth.get(teacher.id) ?? "0.00",
      paidEver: paid,
      paidForMonth: paidForMonth.get(teacher.id) ?? "0.00",
      owed: teacher.salaryType === "PERCENTAGE" ? subtractMoney(earned, paid) : "0.00",
    };
  });
}

/** One teacher, with the payments that earned them a share and their pay so far. */
export async function getTeacherPay(id: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      branches: { include: { branch: { select: { id: true, name: true } } } },
      branchSkills: {
        include: {
          skill: { select: { name: true } },
          branch: { select: { name: true } },
        },
      },
    },
  });
  if (!teacher) return null;

  const [earningsByBranch, branches, payments, payouts, earnedEver, paidEver] = await Promise.all([
    prisma.payment.groupBy({
      by: ["branchId"],
      where: { teacherId: id },
      _sum: { teacherShare: true },
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
  const earned = earnedEver.get(id) ?? "0.00";
  const paid = paidEver.get(id) ?? "0.00";

  return {
    teacher,
    payments,
    payouts,
    earnedEver: earned,
    paidEver: paid,
    owed: subtractMoney(earned, paid),
    earningsByBranch: earningsByBranch.map((row) => ({
      branchId: row.branchId,
      branchName: branchNames.get(row.branchId) ?? "A closed branch",
      amount: fromCents(toCents(row._sum.teacherShare?.toString() ?? 0)),
    })),
  };
}

/**
 * What a percentage teacher is owed right now: everything they've earned minus
 * everything paid to them. Pass the payout being edited to leave it out, so
 * changing an amount is checked against what was owed before it was paid.
 */
export async function percentageOwed(teacherId: string, leaveOut?: string): Promise<string> {
  const [earned, paid] = await Promise.all([
    prisma.payment.aggregate({ where: { teacherId }, _sum: { teacherShare: true } }),
    prisma.expense.aggregate({
      where: {
        teacherId,
        categoryId: TEACHER_SALARY_ID,
        ...(leaveOut ? { id: { not: leaveOut } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);
  return subtractMoney(earned._sum.teacherShare?.toString() ?? 0, paid._sum.amount?.toString() ?? 0);
}

/** What a teacher has been paid for one month, leaving out the payout being edited. */
export async function paidForMonth(
  teacherId: string,
  month: string,
  leaveOut?: string,
): Promise<string> {
  const { _sum } = await prisma.expense.aggregate({
    where: {
      teacherId,
      categoryId: TEACHER_SALARY_ID,
      forMonth: toDbMonth(month),
      ...(leaveOut ? { id: { not: leaveOut } } : {}),
    },
    _sum: { amount: true },
  });
  return fromCents(toCents(_sum.amount?.toString() ?? 0));
}

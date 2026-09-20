import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { collegeToday, fromDbDate, fromDbMonth, toCollegeDate } from "@/lib/dates";
import { parseStudentLookup } from "@/lib/format";
import { subtractMoney, sumMoney, toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { one, type SearchParams } from "@/lib/search-params";
import type { CurrentUser } from "@/lib/session";
import { visibleEnrollments } from "../../students/access";
import { reportBranchId } from "../access";
import { feeMonths } from "../fee-months";
import { ANY } from "../labels";

// Who still owes the college money.
//
// Which months an enrollment owes for is month arithmetic the database can't
// do, so this reads the enrollments in scope with their payments and works it
// out here. That's fine for a college of this size: it's one query over the
// enrollments a person can see, not one per student. If it ever gets slow,
// the fix is a stored count of months paid, not a cleverer query.

export const PAGE_SIZE = 25;

export type OwedFilters = {
  /** Empty means every branch. Staff only ever get their own. */
  branchId: string;
  q: string;
  page: number;
};

export function readOwedFilters(params: SearchParams): OwedFilters {
  const branch = one(params, "branch");
  const page = Number.parseInt(one(params, "page"), 10);
  return {
    branchId: branch === ANY ? "" : branch,
    q: one(params, "q").trim(),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export type OwedSkill = {
  enrollmentId: string;
  skillName: string;
  branchName: string;
  /** The registration fee still owed, or "0.00" when there's nothing to pay. */
  registrationOwed: string;
  monthlyFee: string;
  /** The months with no payment against them, oldest first. */
  unpaidMonths: string[];
  owed: string;
};

export type OwedStudent = {
  id: string;
  number: number;
  fullName: string;
  phone: string | null;
  homeBranchName: string;
  skills: OwedSkill[];
  owed: string;
};

export async function listOwed(user: CurrentUser, filters: OwedFilters) {
  const conditions: Prisma.EnrollmentWhereInput[] = [visibleEnrollments(user)];

  const branchId = reportBranchId(user, filters.branchId);
  if (branchId) conditions.push({ branchSkill: { branchId } });

  if (filters.q) {
    const lookup = parseStudentLookup(filters.q);
    if (lookup.kind === "number") {
      conditions.push({ student: { number: lookup.number } });
    } else if (lookup.kind === "phone") {
      conditions.push({
        student: { OR: [{ phone: lookup.phone }, { responsiblePhone: lookup.phone }] },
      });
    } else {
      conditions.push({ student: { fullName: { contains: lookup.text, mode: "insensitive" } } });
    }
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { AND: conditions },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      statusChangedAt: true,
      monthlyFee: true,
      registrationFee: true,
      skill: { select: { name: true } },
      branchSkill: { select: { branch: { select: { name: true } } } },
      payments: { select: { category: true, forMonth: true } },
      student: {
        select: {
          id: true,
          number: true,
          fullName: true,
          phone: true,
          responsiblePhone: true,
          homeBranch: { select: { name: true } },
        },
      },
    },
  });

  const today = collegeToday();
  const byStudent = new Map<string, OwedStudent>();

  for (const enrollment of enrollments) {
    const paidMonths = new Set(
      enrollment.payments
        .filter((payment) => payment.category === "MONTHLY_FEE" && payment.forMonth)
        .map((payment) => fromDbMonth(payment.forMonth as Date)),
    );
    const unpaidMonths = feeMonths(
      {
        startDate: fromDbDate(enrollment.startDate),
        endDate: fromDbDate(enrollment.endDate),
        status: enrollment.status,
        statusChangedOn: enrollment.statusChangedAt
          ? toCollegeDate(enrollment.statusChangedAt)
          : null,
      },
      today,
    ).filter((month) => !paidMonths.has(month));

    const registrationOwed =
      toCents(enrollment.registrationFee.toString()) > 0 &&
      !enrollment.payments.some((payment) => payment.category === "REGISTRATION_FEE")
        ? enrollment.registrationFee.toString()
        : "0.00";

    const monthlyFee = enrollment.monthlyFee.toString();
    const owed = sumMoney([registrationOwed, ...unpaidMonths.map(() => monthlyFee)]);
    if (toCents(owed) === 0) continue;

    const student = enrollment.student;
    const row = byStudent.get(student.id) ?? {
      id: student.id,
      number: student.number,
      fullName: student.fullName,
      phone: student.phone ?? student.responsiblePhone,
      homeBranchName: student.homeBranch.name,
      skills: [],
      owed: "0.00",
    };
    row.skills.push({
      enrollmentId: enrollment.id,
      skillName: enrollment.skill.name,
      branchName: enrollment.branchSkill.branch.name,
      registrationOwed,
      monthlyFee,
      unpaidMonths,
      owed,
    });
    row.owed = sumMoney([row.owed, owed]);
    byStudent.set(student.id, row);
  }

  // The biggest debts first: that's who the college chases.
  const students = [...byStudent.values()].sort(
    (a, b) => toCents(b.owed) - toCents(a.owed) || a.number - b.number,
  );

  const total = students.length;
  const owedAltogether = sumMoney(students.map((student) => student.owed));
  const registrationOwed = sumMoney(
    students.flatMap((student) => student.skills.map((skill) => skill.registrationOwed)),
  );
  const monthsOwed = students.reduce(
    (count, student) =>
      count + student.skills.reduce((n, skill) => n + skill.unpaidMonths.length, 0),
    0,
  );

  return {
    students: students.slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE),
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    owedAltogether,
    registrationOwed,
    monthlyOwed: subtractMoney(owedAltogether, registrationOwed),
    monthsOwed,
  };
}

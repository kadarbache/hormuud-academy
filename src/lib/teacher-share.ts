import type { Prisma } from "@/generated/prisma/client";
import { percentOf } from "@/lib/money";

/** What a payment records about the teacher it earned a share for. */
export type TeacherShare = {
  teacherId: string | null;
  teacherSharePercent: string | null;
  teacherShare: string | null;
};

const NO_SHARE: TeacherShare = {
  teacherId: null,
  teacherSharePercent: null,
  teacherShare: null,
};

/**
 * A percentage-paid teacher's cut of one monthly fee, worked out when the
 * payment is recorded and kept on it. A teacher on a fixed salary earns
 * nothing from a payment: their pay is an expense on the salary schedule,
 * whatever students hand over.
 *
 * The rate is stored alongside the amount, so raising a teacher's percentage
 * next month never rewrites what they earned last month.
 */
export function teacherShareOf(
  amount: string,
  teacher: { id: string; salaryType: string; percentageRate: Prisma.Decimal | null } | null,
): TeacherShare {
  if (!teacher || teacher.salaryType !== "PERCENTAGE" || !teacher.percentageRate) return NO_SHARE;

  const percent = teacher.percentageRate.toString();
  return {
    teacherId: teacher.id,
    teacherSharePercent: percent,
    teacherShare: percentOf(amount, percent),
  };
}

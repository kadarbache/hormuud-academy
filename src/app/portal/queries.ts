import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Everything here is read for the signed-in student's own ID, taken from
// their login, never from the address bar.

/** Active skills first, then the newest. */
const skillOrder = [
  { status: "asc" },
  { startDate: "desc" },
] satisfies Prisma.EnrollmentOrderByWithRelationInput[];

/** Every skill the student takes or took, at every branch, with when, where and with whom. */
export function getPortalSkills(studentId: string) {
  return prisma.enrollment.findMany({
    where: { studentId },
    orderBy: skillOrder,
    include: {
      skill: { select: { name: true } },
      branchSkill: { select: { branch: { select: { name: true } } } },
      classTime: {
        select: {
          startMinute: true,
          endMinute: true,
          days: true,
          classroom: { select: { name: true } },
          teacher: { select: { name: true } },
        },
      },
    },
  });
}

/** Every skill with its fees and every fee paid for it. */
export function getPortalFees(studentId: string) {
  return prisma.enrollment.findMany({
    where: { studentId },
    orderBy: skillOrder,
    include: {
      skill: { select: { name: true } },
      branchSkill: { select: { branch: { select: { name: true } } } },
      payments: {
        where: { category: { in: ["REGISTRATION_FEE", "MONTHLY_FEE"] } },
        orderBy: [{ forMonth: "asc" }, { paidOn: "asc" }],
        select: {
          category: true,
          forMonth: true,
          amount: true,
          currency: true,
          paidOn: true,
        },
      },
    },
  });
}

/** The student's own details, and whether any skill is Active. */
export async function getPortalDetails(studentId: string) {
  const [student, activeSkills] = await Promise.all([
    prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: { homeBranch: { select: { name: true } } },
    }),
    prisma.enrollment.count({ where: { studentId, status: "ACTIVE" } }),
  ]);
  return { student, isActive: activeSkills > 0 };
}

/** The hours and room a day's mark was taken in. */
const sheetPlace = {
  startMinute: true,
  endMinute: true,
  days: true,
  classroom: { select: { name: true } },
} satisfies Prisma.ClassTimeSelect;

/**
 * One of the student's own skills, with every day they were marked in it,
 * newest first, and what's needed to find the class days nobody marked them:
 * the class time they're in, when they joined and stopped, and the first
 * sheet ever taken there.
 */
export function getPortalAttendance(studentId: string, enrollmentId: string) {
  return prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId },
    select: {
      startDate: true,
      status: true,
      statusChangedAt: true,
      skill: { select: { name: true } },
      branchSkill: { select: { branch: { select: { name: true } } } },
      classTime: {
        select: {
          ...sheetPlace,
          attendanceSheets: { orderBy: { date: "asc" }, take: 1, select: { date: true } },
        },
      },
      attendance: {
        orderBy: { sheet: { date: "desc" } },
        select: {
          mark: true,
          sheet: { select: { date: true, classTime: { select: sheetPlace } } },
        },
      },
    },
  });
}

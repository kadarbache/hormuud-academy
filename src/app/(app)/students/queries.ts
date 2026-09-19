import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { collegeToday, toDbDate } from "@/lib/dates";
import { parseStudentLookup } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { browsableStudents, visibleEnrollments } from "./access";
import type { BranchSkillOption } from "./types";

export const PAGE_SIZE = 25;

export type StudentFilters = {
  q: string;
  status: "all" | "active" | "inactive";
  skillId: string;
  pastEnd: boolean;
  page: number;
};

export function readFilters(params: Record<string, string | string[] | undefined>): StudentFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const status = one("status");
  const page = Number.parseInt(one("page"), 10);
  return {
    q: one("q").trim(),
    status: status === "active" || status === "inactive" ? status : "all",
    skillId: one("skill"),
    pastEnd: one("pastEnd") === "1",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listStudents(user: CurrentUser, filters: StudentFilters) {
  const today = toDbDate(collegeToday());
  const enrollmentScope = visibleEnrollments(user);
  const lookup = filters.q ? parseStudentLookup(filters.q) : null;
  const conditions: Prisma.StudentWhereInput[] = [];

  // An exact ID or phone finds the student at any branch. A name only
  // searches the students this user can already browse.
  if (lookup?.kind === "number") {
    conditions.push({ number: lookup.number });
  } else if (lookup?.kind === "phone") {
    conditions.push({ OR: [{ phone: lookup.phone }, { responsiblePhone: lookup.phone }] });
  } else {
    conditions.push(browsableStudents(user));
    if (lookup?.kind === "name") {
      conditions.push({ fullName: { contains: lookup.text, mode: "insensitive" } });
    }
  }

  // Active and Inactive describe the student across the whole college.
  if (filters.status === "active") conditions.push({ enrollments: { some: { status: "ACTIVE" } } });
  if (filters.status === "inactive") conditions.push({ enrollments: { none: { status: "ACTIVE" } } });
  if (filters.skillId) {
    conditions.push({
      enrollments: { some: { ...enrollmentScope, status: "ACTIVE", skillId: filters.skillId } },
    });
  }
  if (filters.pastEnd) {
    conditions.push({
      enrollments: { some: { ...enrollmentScope, status: "ACTIVE", endDate: { lt: today } } },
    });
  }

  const where: Prisma.StudentWhereInput = { AND: conditions };
  const [total, rows] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { number: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        homeBranch: { select: { name: true } },
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { startDate: "asc" },
          select: {
            endDate: true,
            skill: { select: { name: true } },
            branchSkill: { select: { branchId: true } },
          },
        },
      },
    }),
  ]);

  const students = rows.map((student) => ({
    id: student.id,
    number: student.number,
    fullName: student.fullName,
    sex: student.sex,
    phone: student.phone ?? student.responsiblePhone,
    photoUrl: student.photoUrl,
    homeBranchName: student.homeBranch.name,
    isActive: student.enrollments.length > 0,
    // Skills at other branches stay hidden from branch staff.
    skills: student.enrollments
      .filter((e) => user.role === "admin" || e.branchSkill.branchId === user.branchId)
      .map((e) => ({ name: e.skill.name, pastEnd: e.endDate < today })),
  }));

  return { total, students, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** How many of this user's active enrollments are past their end date. */
export function countPastEnd(user: CurrentUser) {
  return prisma.enrollment.count({
    where: {
      ...visibleEnrollments(user),
      status: "ACTIVE",
      endDate: { lt: toDbDate(collegeToday()) },
    },
  });
}

/** Skills for the list filter: the user's branch, or all of them for an admin. */
export function skillFilterOptions(user: CurrentUser) {
  return prisma.skill.findMany({
    where:
      user.role === "admin"
        ? {}
        : { branchSkills: { some: { branchId: user.branchId ?? "" } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getStudentProfile(user: CurrentUser, id: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      homeBranch: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      enrollments: {
        where: visibleEnrollments(user),
        orderBy: [{ status: "asc" }, { startDate: "desc" }],
        include: {
          skill: { select: { name: true } },
          createdBy: { select: { name: true } },
          branchSkill: {
            select: {
              branchId: true,
              branch: { select: { name: true } },
              teacher: { select: { name: true } },
              classroom: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!student) return null;

  // Status and the "already taking" check look at every branch, even the
  // ones this user can't see.
  const activeAnywhere = await prisma.enrollment.findMany({
    where: { studentId: id, status: "ACTIVE" },
    select: { skillId: true },
  });

  return {
    student,
    isActive: activeAnywhere.length > 0,
    activeSkillIds: activeAnywhere.map((e) => e.skillId),
  };
}

/** Skills a student can join now: open at an active branch, in an active skill. */
export async function enrollableBranchSkills(branchId?: string): Promise<BranchSkillOption[]> {
  const rows = await prisma.branchSkill.findMany({
    where: {
      active: true,
      skill: { active: true },
      branch: { active: true },
      ...(branchId ? { branchId } : {}),
    },
    orderBy: [{ branch: { name: "asc" } }, { skill: { name: "asc" } }],
    include: {
      branch: { select: { name: true } },
      teacher: { select: { name: true } },
      classroom: { select: { name: true } },
      skill: {
        select: {
          name: true,
          durationMonths: true,
          monthlyFee: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    branchId: row.branchId,
    branchName: row.branch.name,
    skillId: row.skillId,
    skillName: row.skill.name,
    categoryName: row.skill.category.name,
    teacherName: row.teacher.name,
    classroomName: row.classroom.name,
    durationMonths: row.skill.durationMonths,
    monthlyFee: row.skill.monthlyFee.toString(),
  }));
}

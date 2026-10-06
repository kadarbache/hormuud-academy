import "server-only";
import type { AttendanceMark, Prisma } from "@/generated/prisma/client";
import { inUse } from "@/lib/clashes";
import { weekdayOf } from "@/lib/class-times";
import { addDays, collegeDayStart, fromDbDate, monthEnd, monthStart, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { visibleClassTimes } from "./access";
import { classDaysBetween } from "./days";
import { countMarks, noMarks, type MarkCounts } from "./labels";

// Who is on an attendance sheet. A sheet lists the students in its class time
// on that day: they had started by then, and were still Active or only
// finished or dropped after it. Moves between class times aren't kept, so a
// sheet taken late lists who is in the class time now. Once saved, a sheet
// keeps everyone it marked, wherever they are later.

/**
 * Enrollments that were taking their skill on at least one day from one date
 * to another. Someone who finished or dropped on a day wasn't there that day.
 */
function enrolledBetween(from: string, to: string) {
  return {
    startDate: { lte: toDbDate(to) },
    OR: [{ status: "ACTIVE" }, { statusChangedAt: { gte: collegeDayStart(addDays(from, 1)) } }],
  } satisfies Prisma.EnrollmentWhereInput;
}

function inClassTimeBetween(classTimeId: string, from: string, to: string) {
  return { classTimeId, ...enrolledBetween(from, to) } satisfies Prisma.EnrollmentWhereInput;
}

/**
 * Not marked on another class time's sheet that day. A student moved here
 * since was in their old class time then, and without this a sheet taken late
 * would list them here too, Present, and count the day twice in their rate.
 */
function notMarkedElsewhere(classTimeId: string, date: string) {
  return {
    attendance: { none: { sheet: { date: toDbDate(date), classTimeId: { not: classTimeId } } } },
  } satisfies Prisma.EnrollmentWhereInput;
}

/** Who belongs on a class time's sheet for a day, with anyone the saved sheet already marks. */
export function onTheSheet(
  classTimeId: string,
  date: string,
  marked: string[] = [],
): Prisma.EnrollmentWhereInput {
  const inClass = {
    ...inClassTimeBetween(classTimeId, date, date),
    ...notMarkedElsewhere(classTimeId, date),
  };
  return marked.length > 0 ? { OR: [inClass, { id: { in: marked } }] } : inClass;
}

const sheetStudent = {
  id: true,
  student: { select: { id: true, number: true, fullName: true, photoUrl: true } },
} satisfies Prisma.EnrollmentSelect;

export type SheetStudent = Prisma.EnrollmentGetPayload<{ select: typeof sheetStudent }>;

const byName = [
  { student: { fullName: "asc" } },
  { student: { number: "asc" } },
] satisfies Prisma.EnrollmentOrderByWithRelationInput[];

/**
 * A class time with what its attendance pages show about it, or null when
 * there's no such class time or the user can't open it: it's at another
 * branch, or someone else teaches it.
 */
export async function findClassTime(user: CurrentUser, id: string) {
  return prisma.classTime.findFirst({
    where: { id, ...visibleClassTimes(user) },
    include: {
      classroom: { select: { id: true, name: true } },
      teacher: { select: { name: true } },
      branchSkill: {
        select: {
          branchId: true,
          skill: { select: { name: true } },
          branch: { select: { name: true } },
        },
      },
    },
  });
}

/** One day's sheet as saved, if it is, and everyone who belongs on it, A to Z. */
export async function loadSheet(classTimeId: string, date: string) {
  const sheet = await prisma.attendanceSheet.findUnique({
    where: { classTimeId_date: { classTimeId, date: toDbDate(date) } },
    include: {
      entries: { select: { enrollmentId: true, mark: true } },
      takenBy: { select: { name: true } },
      changedBy: { select: { name: true } },
    },
  });
  const students = await prisma.enrollment.findMany({
    where: onTheSheet(
      classTimeId,
      date,
      sheet?.entries.map((entry) => entry.enrollmentId),
    ),
    orderBy: byName,
    select: sheetStudent,
  });
  return { sheet, students };
}

export type MonthRow = {
  student: SheetStudent["student"];
  enrollmentId: string;
  /** Each day's mark: null when the sheet was taken without them, undefined when it wasn't taken. */
  marks: Map<string, AttendanceMark | null>;
  counts: MarkCounts;
};

/**
 * One month of a class time's attendance, up to today: its class days, and
 * any day with a saved sheet that isn't one any more, each with whether a
 * sheet was taken, and a row for everyone in the class time that month.
 */
export async function loadMonth(
  classTime: { id: string } & Parameters<typeof classDaysBetween>[0],
  month: string,
  today: string,
) {
  const from = monthStart(month);
  const to = monthEnd(month) < today ? monthEnd(month) : today;
  if (from > to) return { days: [] as { date: string; taken: boolean }[], rows: [] as MonthRow[] };

  const sheets = await prisma.attendanceSheet.findMany({
    where: { classTimeId: classTime.id, date: { gte: toDbDate(from), lte: toDbDate(to) } },
    select: { date: true, entries: { select: { enrollmentId: true, mark: true } } },
  });
  const sheetOn = new Map(sheets.map((sheet) => [fromDbDate(sheet.date), sheet]));
  const days = [...new Set([...classDaysBetween(classTime, from, to), ...sheetOn.keys()])]
    .toSorted()
    .map((date) => ({ date, taken: sheetOn.has(date) }));

  const marked = [...new Set(sheets.flatMap((sheet) => sheet.entries.map((e) => e.enrollmentId)))];
  const enrollments = await prisma.enrollment.findMany({
    where: {
      OR: [inClassTimeBetween(classTime.id, from, to), { id: { in: marked } }],
    },
    orderBy: byName,
    select: sheetStudent,
  });

  const rows = enrollments.map((enrollment): MonthRow => {
    const marks = new Map<string, AttendanceMark | null>();
    for (const [date, sheet] of sheetOn) {
      marks.set(date, sheet.entries.find((e) => e.enrollmentId === enrollment.id)?.mark ?? null);
    }
    const counts = countMarks([...marks.values()].filter((mark) => mark !== null));
    return { student: enrollment.student, enrollmentId: enrollment.id, marks, counts };
  });

  return { days, rows };
}

/**
 * The class times meeting on a day whose attendance this user can open, in
 * clock order, with that day's sheet if it's taken. Deactivated class times
 * are here while students still come to them. So is any class time with a
 * sheet saved that day, even if it doesn't meet on that day any more. One
 * with nobody in it that day has no sheet to take, so it's left out.
 */
export async function classTimesOn(user: CurrentUser, day: string) {
  const visible = visibleClassTimes(user);
  const date = toDbDate(day);

  const [classTimes, untimed] = await Promise.all([
    prisma.classTime.findMany({
      where: {
        ...visible,
        OR: [
          { AND: [inUse, { startMinute: { not: null } }, { days: { has: weekdayOf(day) } }] },
          { attendanceSheets: { some: { date } } },
        ],
      },
      orderBy: [{ startMinute: "asc" }, { endMinute: "asc" }],
      include: {
        classroom: { select: { name: true } },
        teacher: { select: { name: true } },
        branchSkill: {
          select: {
            branch: { select: { name: true } },
            skill: { select: { name: true } },
          },
        },
        attendanceSheets: {
          where: { date },
          select: {
            takenBy: { select: { name: true } },
            changedBy: { select: { name: true } },
            entries: { select: { mark: true } },
          },
        },
        _count: {
          select: {
            // Shown only while the sheet isn't taken, so any sheet that marks
            // them that day is another class time's: they were there instead.
            enrollments: {
              where: { ...enrolledBetween(day, day), attendance: { none: { sheet: { date } } } },
            },
          },
        },
      },
    }),
    // Students come to these, but with no days set there's no sheet to take.
    prisma.classTime.count({
      where: { ...visible, startMinute: null, enrollments: { some: { status: "ACTIVE" } } },
    }),
  ]);

  return {
    classTimes: classTimes.filter(
      (classTime) => classTime._count.enrollments > 0 || classTime.attendanceSheets.length > 0,
    ),
    untimed,
  };
}

/** Every mark each of these enrollments has had, counted. */
export async function marksByEnrollment(enrollmentIds: string[]) {
  const groups =
    enrollmentIds.length === 0
      ? []
      : await prisma.attendanceEntry.groupBy({
          by: ["enrollmentId", "mark"],
          where: { enrollmentId: { in: enrollmentIds } },
          _count: { _all: true },
        });
  const counts = new Map<string, MarkCounts>();
  for (const group of groups) {
    const forEnrollment = counts.get(group.enrollmentId) ?? noMarks();
    forEnrollment[group.mark] += group._count._all;
    counts.set(group.enrollmentId, forEnrollment);
  }
  return counts;
}

/** Every class time a teacher teaches now, with how many students are in each. */
export async function classTimesTaughtBy(teacherId: string) {
  return prisma.classTime.findMany({
    where: { teacherId, ...inUse },
    orderBy: [{ startMinute: "asc" }, { endMinute: "asc" }],
    include: {
      classroom: { select: { name: true } },
      branchSkill: {
        select: {
          skill: { select: { name: true } },
          branch: { select: { name: true } },
        },
      },
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
  });
}

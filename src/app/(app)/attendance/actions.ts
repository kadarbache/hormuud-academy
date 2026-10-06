"use server";

import { refresh } from "next/cache";
import type { AttendanceMark } from "@/generated/prisma/client";
import { failure, isUniqueViolation, success, type ActionResult } from "@/lib/action-result";
import { collegeToday, isIsoDate, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireSignedIn } from "@/lib/session";
import { canMarkOn, visibleClassTimes } from "./access";
import { sheetDayProblem } from "./days";
import { countMarks, formatCounts, formatLongDay, isMark } from "./labels";
import { onTheSheet } from "./queries";

// Taking attendance. Staff at the class time's branch and the admin take a
// sheet for any of its days up to today, and correct one already saved. The
// class time's teacher takes and corrects today's. See ./access.ts.

const listChanged = failure(
  "The class list changed while this sheet was open. Reload the page and mark it again.",
);

/**
 * Saves a class time's sheet for one day. The form sends a mark for every
 * student on it, as `mark.<enrollmentId>`. The first save records who took
 * it; a later one that changes a mark records who changed it.
 */
export async function saveAttendanceSheet(
  classTimeId: string,
  date: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSignedIn();
  const classTime = await prisma.classTime.findFirst({
    where: { id: classTimeId, ...visibleClassTimes(user) },
    select: { startMinute: true, endMinute: true, days: true },
  });
  if (!classTime) {
    return failure(
      user.role === "admin"
        ? "That class time no longer exists."
        : user.role === "teacher"
          ? "You can only take attendance for the class times you teach."
          : "You can only take attendance at your own branch.",
    );
  }
  if (!isIsoDate(date)) return failure("Pick a day.");
  const today = collegeToday();
  if (!canMarkOn(user, date, today)) {
    return failure("You can only mark today's attendance. Ask the office to change another day's.");
  }

  const saved = await prisma.attendanceSheet.findUnique({
    where: { classTimeId_date: { classTimeId, date: toDbDate(date) } },
    include: { entries: { select: { enrollmentId: true, mark: true } } },
  });
  const problem = sheetDayProblem(classTime, date, today, saved !== null);
  if (problem) return failure(problem);

  const students = await prisma.enrollment.findMany({
    where: onTheSheet(
      classTimeId,
      date,
      saved?.entries.map((entry) => entry.enrollmentId),
    ),
    select: { id: true },
  });
  if (students.length === 0) return failure("Nobody was in this class time that day.");

  const marks = new Map<string, AttendanceMark>();
  for (const [key, value] of formData) {
    if (!key.startsWith("mark.")) continue;
    if (!isMark(value)) return failure("Mark each student Present, Absent, Late or Excused.");
    marks.set(key.slice("mark.".length), value);
  }
  if (marks.size !== students.length || students.some(({ id }) => !marks.has(id))) {
    return listChanged;
  }
  const counts = formatCounts(countMarks(marks.values()));

  if (!saved) {
    try {
      await prisma.attendanceSheet.create({
        data: {
          classTimeId,
          date: toDbDate(date),
          takenById: user.id,
          entries: {
            createMany: { data: [...marks].map(([enrollmentId, mark]) => ({ enrollmentId, mark })) },
          },
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return failure("Someone saved this sheet a moment ago. Reload the page to see their marks.");
      }
      throw error;
    }
    refresh();
    return success(`Attendance taken for ${formatLongDay(date)}: ${counts}.`);
  }

  const before = new Map(saved.entries.map((entry) => [entry.enrollmentId, entry.mark]));
  const changed = [...marks].filter(([enrollmentId, mark]) => before.get(enrollmentId) !== mark);
  if (changed.length === 0) return success("Nothing changed.");

  await prisma.$transaction([
    ...changed.map(([enrollmentId, mark]) =>
      prisma.attendanceEntry.upsert({
        where: { sheetId_enrollmentId: { sheetId: saved.id, enrollmentId } },
        create: { sheetId: saved.id, enrollmentId, mark },
        update: { mark },
      }),
    ),
    prisma.attendanceSheet.update({
      where: { id: saved.id },
      data: { changedById: user.id, changedAt: new Date() },
    }),
  ]);
  refresh();
  return success(`Attendance changed for ${formatLongDay(date)}: ${counts}.`);
}

import type { Prisma } from "@/generated/prisma/client";
import type { AppUser } from "@/lib/session";

// Who takes which attendance.
//
// - The admin takes and corrects any class time's, at every branch.
// - Branch staff take and correct their own branch's, any day up to today,
//   so a sheet kept on paper can be typed in later.
// - A teacher sees only the class times they teach, and marks only today's
//   sheet. Another day's they can read; staff correct it. Whoever covers a
//   class for a day tells the office, and staff take that day's sheet.

/** The class times whose attendance the user can open. */
export function visibleClassTimes(user: AppUser): Prisma.ClassTimeWhereInput {
  if (user.role === "admin") return {};
  if (user.role === "teacher") return { teacherId: user.teacherId };
  return { branchSkill: { branchId: user.branchId ?? "" } };
}

/** Whether the user can save a sheet for this day, in a class time they can open. */
export function canMarkOn(user: AppUser, date: string, today: string) {
  return user.role !== "teacher" || date === today;
}

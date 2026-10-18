import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  classTimeName,
  formatDayList,
  formatHours,
  sharedDays,
  slotOf,
  slotsClash,
  type Slot,
} from "@/lib/class-times";
import { formatStudentNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

// Nobody is in two places at once. A teacher teaches one class time at a
// time at any branch, and a student sits in one at a time. "At once" means
// overlapping hours on a day both meet, so 4–6 pm on Saturdays and 4–6 pm on
// Sundays don't clash.
//
// One exception: a teacher can teach class times of the same skill at a
// branch at exactly the same hours and days, like Computer Basics 1 and 2.
// About 20 students at one hour are taught that way, as two halves, one in
// the Computer lab with a helper and one in a theory room.
//
// The checks run before the write, outside any transaction: the local
// database takes one connection at a time, so a query on `prisma` inside a
// transaction would wait forever.

/**
 * A class time holds its teacher while it's active, and after it's
 * deactivated for as long as students are still in it, because they still
 * come.
 */
export const inUse = {
  OR: [{ active: true }, { enrollments: { some: { status: "ACTIVE" } } }],
} satisfies Prisma.ClassTimeWhereInput;

/** "at 4:00–6:00 pm on Saturday and Monday": when two slots meet together. */
function when(slot: Slot, other: Slot) {
  return `at ${formatHours(other)} on ${formatDayList(sharedDays(slot.days, other.days))}`;
}

/** Whether two slots are exactly the same hours on exactly the same days. */
function sameSlot(a: Slot, b: Slot) {
  return (
    a.startMinute === b.startMinute &&
    a.endMinute === b.endMinute &&
    a.days.length === b.days.length &&
    a.days.every((day) => b.days.includes(day))
  );
}

/**
 * Why a class time, as it's about to be saved, would have its teacher in two
 * places at once, or null. The teacher is checked at every branch by the
 * clock, because a teacher can't be at two branches at once either. Another
 * class time of the same branch skill at exactly the same hours and days
 * doesn't count.
 */
export async function teacherClash(proposed: {
  /** Left out for a new class time. */
  id?: string;
  branchSkillId: string;
  teacherId: string;
  slot: Slot;
}): Promise<string | null> {
  const others = await prisma.classTime.findMany({
    where: {
      AND: [inUse, { teacherId: proposed.teacherId }],
      startMinute: { not: null },
      ...(proposed.id ? { id: { not: proposed.id } } : {}),
    },
    select: {
      branchSkillId: true,
      name: true,
      startMinute: true,
      endMinute: true,
      days: true,
      teacher: { select: { name: true } },
      branchSkill: {
        select: { skill: { select: { name: true } }, branch: { select: { name: true } } },
      },
    },
  });

  const clash = others
    .flatMap((other) => {
      const slot = slotOf(other);
      return slot && slotsClash(proposed.slot, slot) ? [{ ...other, slot }] : [];
    })
    .find(
      (other) =>
        other.branchSkillId !== proposed.branchSkillId || !sameSlot(proposed.slot, other.slot),
    );
  if (!clash) return null;
  const name = classTimeName(clash.branchSkill.skill.name, clash);
  return `${clash.teacher.name} already teaches ${name} at ${clash.branchSkill.branch.name} ${when(proposed.slot, clash.slot)}.`;
}

/**
 * Whether any of these students would be in two places at once if they came
 * at this slot, given the skills they take now at every branch. Leave out the
 * enrollments being placed, so a class time isn't measured against itself.
 * Returns a message naming the first student, or null.
 */
export async function studentClash(
  studentIds: string[],
  slot: Slot,
  leaveOut?: Prisma.EnrollmentWhereInput,
): Promise<string | null> {
  if (studentIds.length === 0) return null;
  const others = await prisma.enrollment.findMany({
    where: {
      studentId: { in: studentIds },
      status: "ACTIVE",
      classTime: { startMinute: { not: null } },
      ...(leaveOut ? { NOT: leaveOut } : {}),
    },
    orderBy: { student: { number: "asc" } },
    select: {
      studentId: true,
      student: { select: { number: true, fullName: true } },
      skill: { select: { name: true } },
      classTime: { select: { startMinute: true, endMinute: true, days: true } },
    },
  });

  const clashing = others.flatMap((other) => {
    const otherSlot = slotOf(other.classTime);
    return otherSlot && slotsClash(slot, otherSlot) ? [{ ...other, slot: otherSlot }] : [];
  });
  const first = clashing[0];
  if (!first) return null;

  const who = `${first.student.fullName} (${formatStudentNumber(first.student.number)})`;
  const more = new Set(clashing.map((other) => other.studentId)).size - 1;
  return `${who} already takes ${first.skill.name} ${when(slot, first.slot)}${
    more > 0 ? `, and ${more} more ${more === 1 ? "student clashes" : "students clash"} too` : ""
  }.`;
}

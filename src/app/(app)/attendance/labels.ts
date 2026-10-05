import type { AttendanceMark } from "@/generated/prisma/client";
import { toDbDate } from "@/lib/dates";

/** The marks in the order the sheet offers them, Present first because most students are. */
export const MARKS: { value: AttendanceMark; label: string; short: string }[] = [
  { value: "PRESENT", label: "Present", short: "P" },
  { value: "ABSENT", label: "Absent", short: "A" },
  { value: "LATE", label: "Late", short: "L" },
  { value: "EXCUSED", label: "Excused", short: "E" },
];

export const markLabel = Object.fromEntries(MARKS.map((mark) => [mark.value, mark.label])) as Record<
  AttendanceMark,
  string
>;

export function isMark(value: unknown): value is AttendanceMark {
  return MARKS.some((mark) => mark.value === value);
}

/** How a mark looks once picked, on the sheet and in the month's grid. */
export const markStyle: Record<AttendanceMark, string> = {
  PRESENT: "border-primary bg-primary text-primary-foreground",
  ABSENT: "border-destructive bg-destructive text-white",
  LATE: "border-warning-border bg-warning text-warning-foreground",
  EXCUSED: "border-border bg-secondary text-secondary-foreground",
};

export type MarkCounts = Record<AttendanceMark, number>;

export const noMarks = (): MarkCounts => ({ PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 });

export function countMarks(marks: Iterable<AttendanceMark>): MarkCounts {
  const counts = noMarks();
  for (const mark of marks) counts[mark] += 1;
  return counts;
}

/**
 * The share of days a student came, out of the days that count: Late counts
 * as present, because they came, and Excused counts neither way. Null when no
 * day counts yet.
 */
export function attendanceRate(counts: MarkCounts): number | null {
  const came = counts.PRESENT + counts.LATE;
  const counted = came + counts.ABSENT;
  return counted === 0 ? null : came / counted;
}

/** 0.9166 -> "92%" */
export function formatRate(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

/** "18 present, 1 late, 2 absent", leaving out the marks nobody got. */
export function formatCounts(counts: MarkCounts) {
  const parts = (["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const)
    .filter((mark) => counts[mark] > 0)
    .map((mark) => `${counts[mark]} ${markLabel[mark].toLowerCase()}`);
  return parts.length > 0 ? parts.join(", ") : "nobody marked";
}

/** "Tue 6 Oct" for a column heading. */
export function formatShortDay(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(toDbDate(isoDate));
}

/** "Tuesday, 6 October 2026" for a sheet's heading. */
export function formatLongDay(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toDbDate(isoDate));
}

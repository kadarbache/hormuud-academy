// Every date the college records (registration, start, end) is a calendar day
// with no time. Postgres stores them as DATE; Prisma hands them back as a JS
// Date at midnight UTC. These helpers keep all of that in one place so no
// screen shifts a date by a day.

/** East Africa Time, UTC+3. "Today" means today at the college. */
export const COLLEGE_TIME_ZONE = "Africa/Nairobi";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const collegeDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: COLLEGE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date at the college, as YYYY-MM-DD. */
export function collegeToday(): string {
  return collegeDay.format(new Date());
}

/**
 * The college's calendar day for a moment in time, like a createdAt stamp.
 * 01:00 on 20 September at the college is still 19 September in UTC.
 */
export function toCollegeDate(moment: Date): string {
  return collegeDay.format(moment);
}

export function isIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  return fromDbDate(toDbDate(value)) === value;
}

/** A YYYY-MM-DD string as the Date Prisma writes to a DATE column. */
export function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** A DATE column value back to YYYY-MM-DD. */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Adds whole months. A day that doesn't exist in the target month moves to
 * that month's last day, so 31 January plus one month is 28 or 29 February.
 */
export function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fromDbDate(target);
}

/** 19 Sept 2026 */
export function formatDate(date: Date | string): string {
  const value = typeof date === "string" ? toDbDate(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

// Months. The financial screens work in whole months as often as in days: a
// budget is set for a month, and a monthly fee pays for one. A month is
// written YYYY-MM, which is what <input type="month"> gives, and stored as
// that month's first day in a DATE column.

const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** This month at the college, as YYYY-MM. */
export function collegeMonth(): string {
  return collegeToday().slice(0, 7);
}

/** The month a day falls in. "2026-09-19" -> "2026-09" */
export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function isIsoMonth(value: string) {
  return ISO_MONTH.test(value);
}

/** The first day of a month, as YYYY-MM-DD. */
export function monthStart(isoMonth: string): string {
  return `${isoMonth}-01`;
}

/** The last day of a month, as YYYY-MM-DD. */
export function monthEnd(isoMonth: string): string {
  return addDays(addMonths(monthStart(isoMonth), 1), -1);
}

/** A month as the Date Prisma writes to a DATE column. */
export function toDbMonth(isoMonth: string): Date {
  return toDbDate(monthStart(isoMonth));
}

/** A DATE column holding a month's first day, back to YYYY-MM. */
export function fromDbMonth(date: Date): string {
  return fromDbDate(date).slice(0, 7);
}

/** Adds whole months to a month. "2026-12" plus 1 is "2027-01". */
export function addMonthsToMonth(isoMonth: string, months: number): string {
  return monthOf(addMonths(monthStart(isoMonth), months));
}

/** Every month from one to another, both included. Empty if they're the wrong way round. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to; month = addMonthsToMonth(month, 1)) {
    months.push(month);
  }
  return months;
}

export function addDays(isoDate: string, days: number): string {
  const date = toDbDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return fromDbDate(date);
}

/** Sept 2026 */
export function formatMonth(month: string | Date): string {
  const isoMonth = typeof month === "string" ? month : fromDbMonth(month);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  }).format(toDbMonth(isoMonth));
}

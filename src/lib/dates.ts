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

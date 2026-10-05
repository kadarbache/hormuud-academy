import { formatDayList, slotOf, weekdayOf, type ClassTimeHours } from "@/lib/class-times";
import { addDays } from "@/lib/dates";

// Which days a class time takes attendance on. Only its own days for now: a
// lesson made up on another day isn't recorded. Each sheet keeps its real
// date, so allowing other days later changes no sheet already saved.

/** Whether a class time meets on a day: its hours are set and the day is one of its days. */
export function meetsOn(classTime: ClassTimeHours, isoDate: string) {
  return slotOf(classTime) !== null && classTime.days.includes(weekdayOf(isoDate));
}

/** The days from one date to another, both included, that a class time meets on. */
export function classDaysBetween(classTime: ClassTimeHours, from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (meetsOn(classTime, day)) days.push(day);
  }
  return days;
}

/** The last few days a class time met on, up to and including today, oldest first. */
export function recentClassDays(classTime: ClassTimeHours, today: string, count: number): string[] {
  if (slotOf(classTime) === null || classTime.days.length === 0) return [];
  const days: string[] = [];
  for (let day = today; days.length < count; day = addDays(day, -1)) {
    if (meetsOn(classTime, day)) days.unshift(day);
  }
  return days;
}

/**
 * Why a sheet can't be taken for a day, or null when it can. A sheet already
 * saved can always be opened and corrected, even if the class time's days
 * have changed since.
 */
export function sheetDayProblem(
  classTime: ClassTimeHours,
  isoDate: string,
  today: string,
  saved: boolean,
): string | null {
  if (slotOf(classTime) === null) {
    return "This class time has no hours and days yet, so it takes no attendance. The admin sets them on the skill's page.";
  }
  if (isoDate > today) return "That day hasn't come yet.";
  if (!saved && !meetsOn(classTime, isoDate)) {
    return `This class time doesn't meet on ${formatDayList([weekdayOf(isoDate)])}s. It meets on ${formatDayList(classTime.days)}.`;
  }
  return null;
}

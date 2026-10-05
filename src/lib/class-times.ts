import type { Weekday } from "@/generated/prisma/client";

/** The days of the week, in the order the college's week runs. */
export const WEEKDAYS: { value: Weekday; short: string; long: string }[] = [
  { value: "SATURDAY", short: "Sat", long: "Saturday" },
  { value: "SUNDAY", short: "Sun", long: "Sunday" },
  { value: "MONDAY", short: "Mon", long: "Monday" },
  { value: "TUESDAY", short: "Tue", long: "Tuesday" },
  { value: "WEDNESDAY", short: "Wed", long: "Wednesday" },
  { value: "THURSDAY", short: "Thu", long: "Thursday" },
  { value: "FRIDAY", short: "Fri", long: "Friday" },
];

/** A class time's hours, in minutes after midnight: 4 pm is 960. */
export type Hours = { startMinute: number; endMinute: number };

/** When a class time meets: its hours, on its days. */
export type Slot = Hours & { days: Weekday[] };

/** A class time as stored: its hours are empty until the admin sets them. */
export type ClassTimeHours = { startMinute: number | null; endMinute: number | null; days: Weekday[] };

/** 960 -> "4:00 pm". Midnight is "12:00 am" and noon "12:00 pm". */
export function formatClock(minute: number) {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = String(minute % 60).padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? "am" : "pm"}`;
}

/** "4:00–6:00 pm", or "11:00 am–1:00 pm" when the hours cross noon. */
export function formatHours({ startMinute, endMinute }: Hours) {
  const start = formatClock(startMinute);
  const end = formatClock(endMinute);
  return `${start.slice(-2) === end.slice(-2) ? start.slice(0, -3) : start}–${end}`;
}

/** "Sat Mon Wed", in week order, or "Every day". */
export function formatDays(days: Weekday[]) {
  const picked = WEEKDAYS.filter((day) => days.includes(day.value));
  return picked.length === WEEKDAYS.length ? "Every day" : picked.map((day) => day.short).join(" ");
}

/** "Saturday, Monday and Wednesday", in week order, for a sentence. */
export function formatDayList(days: Weekday[]) {
  const names = WEEKDAYS.filter((day) => days.includes(day.value)).map((day) => day.long);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}

/**
 * "4:00–6:00 pm, Sat Mon Wed". A class time carried over from before class
 * times had hours has neither until the admin sets them.
 */
export function formatSlot(classTime: ClassTimeHours) {
  const slot = slotOf(classTime);
  return slot ? `${formatHours(slot)}, ${formatDays(slot.days)}` : "Time not set";
}

/** "16:00", from an <input type="time">, -> 960. Seconds are ignored. Null for anything else. */
export function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** 960 -> "16:00", what an <input type="time"> holds. */
export function toClockInput(minute: number) {
  const hours = String(Math.floor(minute / 60)).padStart(2, "0");
  return `${hours}:${String(minute % 60).padStart(2, "0")}`;
}

/** Whether two sets of hours overlap. One ending at 4 pm and the next starting at 4 pm don't. */
export function hoursOverlap(a: Hours, b: Hours) {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/** The days two class times both meet on, in week order. */
export function sharedDays(a: Weekday[], b: Weekday[]) {
  return WEEKDAYS.map((day) => day.value).filter((day) => a.includes(day) && b.includes(day));
}

/** Whether two class times meet at the same moment: overlapping hours on a day they share. */
export function slotsClash(a: Slot, b: Slot) {
  return hoursOverlap(a, b) && sharedDays(a.days, b.days).length > 0;
}

/** JavaScript counts the week from Sunday; the college's runs from Saturday. */
const BY_JS_DAY: Weekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

/** The day of the week a YYYY-MM-DD date falls on. */
export function weekdayOf(isoDate: string): Weekday {
  return BY_JS_DAY[new Date(`${isoDate}T00:00:00.000Z`).getUTCDay()];
}

/** A class time's slot, or null while its hours aren't set. */
export function slotOf({ startMinute, endMinute, days }: ClassTimeHours): Slot | null {
  return startMinute !== null && endMinute !== null ? { startMinute, endMinute, days } : null;
}

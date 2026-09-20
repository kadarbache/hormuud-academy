import { monthOf, monthsBetween } from "@/lib/dates";

/** The parts of an enrollment that decide which months it owes a fee for. */
export type FeeMonthsInput = {
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "FINISHED" | "DROPPED";
  /** The college day the enrollment was finished or dropped, if it was. */
  statusChangedOn: string | null;
};

/**
 * The months one enrollment owes a monthly fee for, oldest first.
 *
 * It starts the month the student joined and runs to whichever comes first:
 * the skill's last month, the month the student stopped, or this month.
 * Nobody owes for a month that hasn't happened, and a student who dropped in
 * March doesn't owe for April.
 */
export function feeMonths(enrollment: FeeMonthsInput, today: string): string[] {
  const ends = [monthOf(enrollment.endDate), monthOf(today)];
  if (enrollment.status !== "ACTIVE" && enrollment.statusChangedOn) {
    ends.push(monthOf(enrollment.statusChangedOn));
  }
  const last = ends.reduce((earliest, month) => (month < earliest ? month : earliest));
  return monthsBetween(monthOf(enrollment.startDate), last);
}

import { addMonthsToMonth, monthOf, monthsBetween } from "@/lib/dates";
import { isPositiveMoney } from "@/lib/money";

/** The parts of an enrollment that decide which months it owes a fee for. */
export type FeeMonthsInput = {
  /** The monthly fee the student joined at. A free skill has no fee months. */
  monthlyFee: string;
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
 *
 * A skill lasting four months is four fee months, so it owes exactly its
 * duration times the monthly fee. The end date is the start date plus the
 * duration, which lands in the month after the last one taught, so that month
 * isn't charged: joining on 19 April a 4-month skill ends 19 August and
 * owes April to July.
 *
 * A monthly fee of zero means the skill is free, the same way a registration
 * fee of zero means none: it has no fee months, so nothing is ever owed for it.
 */
export function feeMonths(enrollment: FeeMonthsInput, today: string): string[] {
  if (!isPositiveMoney(enrollment.monthlyFee)) return [];
  const lastTaught = addMonthsToMonth(monthOf(enrollment.endDate), -1);
  const ends = [lastTaught, monthOf(today)];
  if (enrollment.status !== "ACTIVE" && enrollment.statusChangedOn) {
    ends.push(monthOf(enrollment.statusChangedOn));
  }
  const last = ends.reduce((earliest, month) => (month < earliest ? month : earliest));
  return monthsBetween(monthOf(enrollment.startDate), last);
}

import {
  collegeMonth,
  collegeToday,
  formatDate,
  formatMonth,
  isIsoDate,
  isIsoMonth,
  monthEnd,
  monthStart,
  toDbDate,
} from "@/lib/dates";
import { one, type SearchParams } from "@/lib/search-params";

// Every financial screen answers "over what stretch of time?". A day for the
// takings at the counter, a month for the books, or everything for looking
// something up. The choice lives in the query string so a link can carry it.

export type Period = {
  kind: "day" | "month" | "all";
  /** The day being shown, as YYYY-MM-DD. Kept even when a month is picked. */
  day: string;
  /** The month being shown, as YYYY-MM. */
  month: string;
};

export function readPeriod(params: SearchParams): Period {
  const kind = one(params, "period");
  const day = one(params, "day");
  const month = one(params, "month");
  return {
    kind: kind === "month" || kind === "all" ? kind : "day",
    day: isIsoDate(day) ? day : collegeToday(),
    month: isIsoMonth(month) ? month : collegeMonth(),
  };
}

/** The first and last day a period covers, or null when it covers everything. */
export function periodDays(period: Period): { from: string; to: string } | null {
  if (period.kind === "all") return null;
  if (period.kind === "month") {
    return { from: monthStart(period.month), to: monthEnd(period.month) };
  }
  return { from: period.day, to: period.day };
}

/** A period as a filter on a DATE column. Undefined means don't filter. */
export function periodFilter(period: Period) {
  const days = periodDays(period);
  if (!days) return undefined;
  return { gte: toDbDate(days.from), lte: toDbDate(days.to) };
}

/** "19 Sept 2026", "Sept 2026" or "every month so far". */
export function periodLabel(period: Period): string {
  if (period.kind === "all") return "every month so far";
  if (period.kind === "month") return formatMonth(period.month);
  return formatDate(period.day);
}

/**
 * A period as it reads at the end of a sentence: "on 19 Sept 2026", "in
 * Sept 2026" or "yet". periodLabel names the period; this one slots into
 * "Nothing was recorded ...".
 */
export function periodPhrase(period: Period): string {
  if (period.kind === "all") return "yet";
  if (period.kind === "month") return `in ${formatMonth(period.month)}`;
  return `on ${formatDate(period.day)}`;
}

/**
 * The period part of a link, so filters survive a click. The kind is always
 * spelled out, because a screen may open something other than a day when it
 * is missing (Expenses opens the month).
 */
export function periodParams(period: Period): [string, string][] {
  if (period.kind === "all") return [["period", "all"]];
  if (period.kind === "month") {
    return [
      ["period", "month"],
      ["month", period.month],
    ];
  }
  return [
    ["period", "day"],
    ["day", period.day],
  ];
}

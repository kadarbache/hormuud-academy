import type { Currency } from "@/generated/prisma/client";
import {
  amountForInput,
  dollarsToShillings,
  isPositiveMoney,
  shillingsToDollars,
  sumMoney,
  toCents,
  type MoneyTotal,
} from "@/lib/money";

// Working out a teacher's pay across the two currencies. A fixed salary is
// set in one currency and paid in it; a percentage teacher earns in whichever
// currency each student paid, and is paid out of each ledger separately.

/**
 * What a fixed teacher has been paid for a month, in their salary's currency.
 * Their pay goes out in that currency, but a salary paid before the admin
 * changed it may be in the other one, so that part counts at today's rate.
 */
export function paidInSalaryCurrency(
  paid: MoneyTotal,
  salaryCurrency: Currency,
  rate: string | null,
): string {
  const other = salaryCurrency === "USD" ? paid.SLSH : paid.USD;
  if (toCents(other) === 0 || !rate) return paid[salaryCurrency];
  const converted =
    salaryCurrency === "USD" ? shillingsToDollars(other, rate) : dollarsToShillings(other, rate);
  return sumMoney([paid[salaryCurrency], converted]);
}

/**
 * What the pay dialog starts at for one teacher: a fixed teacher's salary in
 * its currency, or a percentage teacher's unpaid share, in dollars first if
 * they're owed any, and in shillings when that currency is picked.
 */
export function payDefaults(teacher: {
  salaryType: "FIXED" | "PERCENTAGE";
  fixedSalary: string;
  salaryCurrency: Currency;
  unpaidShare: MoneyTotal;
}): { currency: Currency; amounts: Partial<Record<Currency, string>> } {
  if (teacher.salaryType === "FIXED") {
    return {
      currency: teacher.salaryCurrency,
      amounts: isPositiveMoney(teacher.fixedSalary)
        ? { [teacher.salaryCurrency]: amountForInput(teacher.fixedSalary, teacher.salaryCurrency) }
        : {},
    };
  }

  const owed = (["USD", "SLSH"] as const).filter((currency) =>
    isPositiveMoney(teacher.unpaidShare[currency]),
  );
  return {
    currency: owed[0] ?? "USD",
    amounts: Object.fromEntries(
      owed.map((currency) => [currency, amountForInput(teacher.unpaidShare[currency], currency)]),
    ),
  };
}

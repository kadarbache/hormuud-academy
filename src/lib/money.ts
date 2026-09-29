import type { Currency } from "@/generated/prisma/client";

// Money is stored as DECIMAL and handed around as a string like "1234.50", so
// no amount ever passes through a float. These helpers add and split those
// strings by working in whole cents.
//
// The college keeps two ledgers, US dollars and Somaliland shillings. The
// same helpers serve both: a shilling amount is just a string with no cents
// that matter. Shillings are turned into dollars to keep each row's dollar
// value on the day it was recorded, and to show what the two ledgers come to
// together at today's rate. A total is never stored.

/** "20.50" -> 2050. Rounds, so a stray third decimal can't creep in. */
export function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

/** 2050 -> "20.50" */
export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Adds amounts. "10.10" + "15.20" is "25.30", not 25.299999999999997. */
export function sumMoney(values: Iterable<string | number>): string {
  let cents = 0;
  for (const value of values) cents += toCents(value);
  return fromCents(cents);
}

export function subtractMoney(from: string | number, take: string | number): string {
  return fromCents(toCents(from) - toCents(take));
}

/**
 * The smallest amount each currency is counted in, in cents. Dollars go down
 * to the cent; shillings are whole, because there's no coin smaller than one.
 */
const unitCents: Record<Currency, number> = { USD: 1, SLSH: 100 };

/** Rounds cents to the currency's smallest amount. */
function roundCents(cents: number, currency: Currency): number {
  return Math.round(cents / unitCents[currency]) * unitCents[currency];
}

/**
 * A percentage of an amount, to the nearest cent, or the nearest shilling for
 * a shilling amount. 30% of "100" is "30.00".
 */
export function percentOf(
  amount: string | number,
  percent: string | number,
  currency: Currency = "USD",
): string {
  return fromCents(roundCents((toCents(amount) * Number(percent)) / 100, currency));
}

export function isPositiveMoney(value: string | number) {
  return toCents(value) > 0;
}

/** A dollar amount in shillings, to the nearest shilling. "10" at 8550 is "85500". */
export function dollarsToShillings(dollars: string | number, rate: string | number): string {
  return String(Math.round((toCents(dollars) * Number(rate)) / 100));
}

/** A shilling amount in dollars, to the nearest cent. "85500" at 8550 is "10.00". */
export function shillingsToDollars(shillings: string | number, rate: string | number): string {
  return fromCents(Math.round(toCents(shillings) / Number(rate)));
}

/**
 * An amount the way a form box shows it: dollars with cents, shillings
 * without. "85500.00" in shillings is "85500".
 */
export function amountForInput(value: string | number, currency: Currency): string {
  return currency === "SLSH" ? String(Math.round(Number(value))) : fromCents(toCents(value));
}

// ---------------------------------------------------------------------------
// The two ledgers
// ---------------------------------------------------------------------------

/**
 * Which ledger a payment or expense goes in: its currency, and for shillings
 * the exchange rate in force when it's recorded, which it keeps for good.
 */
export type Ledger = { currency: Currency; exchangeRate: string | null };

/**
 * What an amount was worth in dollars the day it was recorded, to the cent:
 * the amount itself for dollars, or the shillings at the rate in force then.
 */
export function dollarValue(amount: string | number, ledger: Ledger): string {
  if (ledger.currency === "USD") return fromCents(toCents(amount));
  if (!ledger.exchangeRate) throw new Error("A shilling amount needs its exchange rate.");
  return shillingsToDollars(amount, ledger.exchangeRate);
}

/**
 * The columns that put an amount in its ledger: the amount, its currency,
 * the rate for shillings, and its dollar value that day. The row keeps all
 * of it as it was, like a receipt.
 */
export function inLedger(amount: string, ledger: Ledger) {
  return { amount, ...ledger, usdValue: dollarValue(amount, ledger) };
}

// ---------------------------------------------------------------------------
// Totals across both ledgers
// ---------------------------------------------------------------------------

/** Money kept per currency, the way the books keep it. The two are never added together. */
export type MoneyTotal = Record<Currency, string>;

export const ZERO_TOTAL: MoneyTotal = { USD: "0.00", SLSH: "0.00" };

/** One sum out of the database: the amounts in one currency. */
export type LedgerSum = {
  currency: Currency;
  amount: { toString(): string } | null;
};

/** Adds up sums from both ledgers into a total, currency by currency. */
export function totalOf(sums: Iterable<LedgerSum>): MoneyTotal {
  const cents = { USD: 0, SLSH: 0 };
  for (const sum of sums) cents[sum.currency] += toCents(sum.amount?.toString() ?? 0);
  return { USD: fromCents(cents.USD), SLSH: fromCents(cents.SLSH) };
}

/**
 * A total, and what its two currencies come to together in dollars: its
 * combined figure. Null when it holds shillings and there's no rate to turn
 * them into dollars.
 */
export type Figure = MoneyTotal & { combined: string | null };

/**
 * A total with its combined figure at a rate. Every total is shown at
 * today's rate: it says what the college's money is worth now, so it moves
 * when the rate does. Each receipt keeps its own dollar value from the day.
 */
export function totalAtRate(total: MoneyTotal, rate: string | null): Figure {
  const usd = fromCents(toCents(total.USD));
  const slsh = fromCents(toCents(total.SLSH));
  if (toCents(slsh) === 0) return { USD: usd, SLSH: slsh, combined: usd };
  if (!rate) return { USD: usd, SLSH: slsh, combined: null };
  return { USD: usd, SLSH: slsh, combined: sumMoney([usd, shillingsToDollars(slsh, rate)]) };
}

/**
 * The combined figure alone, where a screen needs a plain dollar amount. A
 * shilling can only be recorded once a rate is set, and rates are never
 * deleted, so shillings with no rate to convert them at mean a bug.
 */
export function combinedAt(total: MoneyTotal, rate: string | null): string {
  const { combined } = totalAtRate(total, rate);
  if (combined === null) throw new Error("Shillings are on record but no exchange rate is set.");
  return combined;
}

export function sumTotals(totals: Iterable<MoneyTotal>): MoneyTotal {
  const list = [...totals];
  return {
    USD: sumMoney(list.map((total) => total.USD)),
    SLSH: sumMoney(list.map((total) => total.SLSH)),
  };
}

/** One total minus another, currency by currency. Income minus expenses is the net balance. */
export function subtractTotals(from: MoneyTotal, take: MoneyTotal): MoneyTotal {
  return {
    USD: subtractMoney(from.USD, take.USD),
    SLSH: subtractMoney(from.SLSH, take.SLSH),
  };
}

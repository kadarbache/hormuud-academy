// Money is stored as DECIMAL and handed around as a string like "1234.50", so
// no amount ever passes through a float. These helpers add and split those
// strings by working in whole cents.

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

/** A percentage of an amount, to the nearest cent. 30% of "100" is "30.00". */
export function percentOf(amount: string | number, percent: string | number): string {
  return fromCents(Math.round((toCents(amount) * Number(percent)) / 100));
}

export function isPositiveMoney(value: string | number) {
  return toCents(value) > 0;
}

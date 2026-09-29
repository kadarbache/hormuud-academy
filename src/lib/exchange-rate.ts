import "server-only";
import { cache } from "react";
import type { Currency } from "@/generated/prisma/client";
import type { Ledger } from "@/lib/money";
import { prisma } from "@/lib/prisma";

// The exchange rate the admin sets on the Settings page: how many Somaliland
// shillings one US dollar is. A shilling payment or expense keeps the rate in
// force when it's recorded, like a receipt. Today's rate is what values every
// combined figure, and turns a fee, which is set in dollars, into shillings.

/** The latest rate the admin set, with who set it and when. Null until there is one. */
export const latestRate = cache(async () => {
  return prisma.exchangeRate.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { setBy: { select: { name: true } } },
  });
});

/** The rate in force, like "8550", or null until the admin sets one. */
export async function currentRate(): Promise<string | null> {
  return (await latestRate())?.rate.toString() ?? null;
}

export const NO_RATE_MESSAGE =
  "There's no exchange rate yet, so shillings can't be recorded. The admin sets it under Settings.";

/**
 * The ledger a new payment or expense goes in: the currency, and for
 * shillings the rate in force, kept on the row for good. Null when shillings
 * are picked but the admin hasn't set a rate yet.
 */
export async function ledgerFields(currency: Currency): Promise<Ledger | null> {
  if (currency === "USD") return { currency, exchangeRate: null };
  const rate = await currentRate();
  return rate ? { currency, exchangeRate: rate } : null;
}

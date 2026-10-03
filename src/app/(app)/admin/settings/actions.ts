"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { invalid, success, type ActionResult } from "@/lib/action-result";
import { formatRate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { exchangeRate, formObject } from "@/lib/validation";

/**
 * Sets the exchange rate: how many shillings one dollar is. Every change is
 * a new row, so the old rates stay as a record of who changed it and when.
 * Every combined figure moves to the new rate at once; each shilling payment
 * and expense already recorded keeps its own, like a receipt.
 */
export async function setExchangeRate(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = z.object({ rate: exchangeRate() }).safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  await prisma.exchangeRate.create({ data: { rate: parsed.data.rate, setById: user.id } });

  refresh();
  return success(
    `The rate is now ${formatRate(parsed.data.rate)} shillings to the dollar. Every combined figure uses it; receipts keep their own.`,
  );
}

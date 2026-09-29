import { z } from "zod";
import { isIsoDate, isIsoMonth } from "@/lib/dates";
import { isBlankEntry, NATIONAL_DIGITS, PHONE_PREFIX, toStoredPhone } from "@/lib/phone";

/** Text the user must fill in. */
export const requiredText = (message: string, max = 120) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message)
    .max(max, `Keep it under ${max} characters.`);

/** Text that may be left empty. Empty becomes null. */
export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : null));

/**
 * A phone number that may be left empty. The form asks for the nine digits
 * after "+252" and the database keeps the whole number, so this puts the two
 * halves together. A box holding nothing but the 6 it starts with counts as
 * empty, because nobody typed it.
 */
export const optionalPhone = z
  .string()
  .optional()
  .transform((value) => (value && !isBlankEntry(value) ? value.trim() : ""))
  .refine((value) => value === "" || toStoredPhone(value) !== null, {
    message: `Enter the ${NATIONAL_DIGITS} digits after ${PHONE_PREFIX}, like 61 1111111.`,
  })
  .transform((value) => (value ? toStoredPhone(value) : null));

/** A calendar day from an <input type="date">. */
export const isoDate = (message = "Pick a date.") =>
  z.string({ error: message }).refine(isIsoDate, { message, abort: true });

/** A month from an <input type="month">. */
export const isoMonth = (message = "Pick a month.") =>
  z.string({ error: message }).refine(isIsoMonth, { message, abort: true });

/** An id from a <select>. */
export const requiredId = (message: string) =>
  z.string({ error: message }).min(1, message);

/** US dollars with up to two decimals, like 20 or 20.50. Zero is allowed. */
export const money = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 20 or 20.50.");

/**
 * Whole Somaliland shillings, like 85000. Big shilling amounts are often
 * typed with commas or spaces, so those are dropped. Zero is allowed.
 */
export const shillings = (message: string) =>
  z
    .string({ error: message })
    .transform((value) => value.replace(/[\s,]/g, ""))
    .pipe(z.string().regex(/^\d{1,12}$/, "Enter whole shillings, like 85000."));

/** Which currency an amount is in, from a currency picker. */
export const currency = (message = "Pick the currency.") =>
  z.enum(["USD", "SLSH"], { error: message });

/**
 * An amount in the currency picked next to it: dollars and cents, or whole
 * shillings. The currency comes straight from the form, so a bad one checks
 * the amount as dollars and the currency picker gets its own error.
 */
export const moneyIn = (currencyValue: string | undefined, message: string) =>
  currencyValue === "SLSH" ? shillings(message) : money(message);

/** An exchange rate: how many shillings one dollar is, like 8550 or 8,550. */
export const exchangeRate = (message = "Enter how many shillings one dollar is.") =>
  z
    .string({ error: message })
    .transform((value) => value.replace(/[\s,]/g, ""))
    .pipe(
      z
        .string()
        .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter the rate like 8550.")
        .refine((value) => Number(value) > 0, "The rate has to be above zero."),
    );

/** A percentage from 0 to 100, like 30 or 12.5. */
export const percent = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .regex(/^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/, "Enter a percentage between 0 and 100.");

/** How money changed hands, from a payment method picker. */
export const paymentMethod = (message = "Pick how the money was paid.") =>
  z.enum(["CASH", "ZAAD", "EDAHAB", "BANK"], { error: message });

/** Reads a form into a plain object. Use getAll() for fields that repeat. */
export function formObject(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

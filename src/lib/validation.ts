import { z } from "zod";
import { isIsoDate, isIsoMonth } from "@/lib/dates";
import { normalizePhone } from "@/lib/format";

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

/** A phone number that may be left empty. Spaces and dashes are removed. */
export const optionalPhone = z
  .string()
  .optional()
  .transform((value) => (value ? normalizePhone(value) : ""))
  .refine((value) => value === "" || /^\+?\d{6,15}$/.test(value), {
    message: "Enter 6 to 15 digits, with an optional + in front.",
  })
  .transform((value) => (value ? value : null));

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

import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
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

/** An id from a <select>. */
export const requiredId = (message: string) =>
  z.string({ error: message }).min(1, message);

/** US dollars with up to two decimals, like 20 or 20.50. */
export const money = z
  .string({ error: "Enter the monthly fee." })
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 20 or 20.50.");

/** Reads a form into a plain object. Use getAll() for fields that repeat. */
export function formObject(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

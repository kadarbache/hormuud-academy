import { z } from "zod";

export type FieldErrors = Partial<Record<string, string[]>>;

/** What every server action returns to the form or button that called it. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function success<T = undefined>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, message, data };
}

export function failure(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function invalid(error: z.ZodError): ActionResult<never> {
  return failure("Check the highlighted fields.", z.flattenError(error).fieldErrors);
}

/** True when Prisma refused a write because a unique constraint was hit. */
export function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** True when Prisma refused a delete because other rows still point at the row. */
export function isForeignKeyViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["P2003", "P2014"].includes(String((error as { code?: unknown }).code))
  );
}

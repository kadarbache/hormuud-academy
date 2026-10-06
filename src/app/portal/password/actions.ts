"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { endSessions, isPassword, setPassword } from "@/lib/passwords";
import { consumeRateLimit } from "@/lib/rate-limit";
import { requireStudent } from "@/lib/session";
import { formObject } from "@/lib/validation";

// Wrong current passwords count against the login, like sign-in attempts, so
// a phone left signed in can't be used to guess it.
const LIMIT = { window: 60, max: 5 };

const passwordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string({ error: "Choose a password." })
      .min(8, "Use at least 8 characters.")
      .max(128, "Keep it under 128 characters."),
    confirmPassword: z.string({ error: "Type the password again." }),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords aren't the same.",
  });

/**
 * The student chooses their own password. On a temporary one from staff they
 * just signed in with it, so it isn't asked for again; otherwise it is. Every
 * other phone they're signed in on is logged out.
 */
export async function changePassword(formData: FormData): Promise<ActionResult> {
  const user = await requireStudent({ onTemporaryPassword: true });
  const parsed = passwordSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { currentPassword, newPassword } = parsed.data;

  const limit = await consumeRateLimit(`portal-password:${user.id}`, LIMIT);
  if (!limit.allowed) {
    return failure(`Too many tries. Wait ${limit.retryAfter} seconds and try again.`);
  }

  if (!user.mustChangePassword) {
    if (!currentPassword || !(await isPassword(user.id, currentPassword))) {
      return failure("Check the highlighted fields.", {
        currentPassword: ["That isn't your password now."],
      });
    }
  }
  if (await isPassword(user.id, newPassword)) {
    return failure("Check the highlighted fields.", {
      newPassword: [
        user.mustChangePassword
          ? "Choose a password of your own, not the one from your branch."
          : "That's your password already. Choose a new one.",
      ],
    });
  }

  await setPassword(user.id, newPassword, { temporary: false });
  const session = await auth.api.getSession({ headers: await headers() });
  await endSessions(user.id, { except: session?.session.id });

  return success("Password changed.");
}

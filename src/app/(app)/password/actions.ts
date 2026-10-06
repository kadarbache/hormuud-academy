"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { endSessions, hasPassword, isPassword, setPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { requireTeacher } from "@/lib/session";
import { recordTeacherLogin, teacherPasswordProblem } from "@/lib/teacher-logins";
import { formObject } from "@/lib/validation";

// Wrong current passwords count against the login, like sign-in attempts, so
// a phone left signed in can't be used to guess it.
const LIMIT = { window: 60, max: 5 };

const passwordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string({ error: "Choose a password." })
      .max(128, "Keep it under 128 characters."),
    confirmPassword: z.string({ error: "Type the password again." }),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords aren't the same.",
  });

/**
 * The teacher chooses their own password. On a temporary one from the admin
 * they just signed in with it, so it isn't asked for again; otherwise it is.
 * Every other device they're signed in on is logged out.
 */
export async function changeTeacherPassword(formData: FormData): Promise<ActionResult> {
  const user = await requireTeacher({ onTemporaryPassword: true });
  const parsed = passwordSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { currentPassword, newPassword } = parsed.data;

  const limit = await consumeRateLimit(`teacher-password:${user.id}`, LIMIT);
  if (!limit.allowed) {
    return failure(`Too many tries. Wait ${limit.retryAfter} seconds and try again.`);
  }

  // Only the admin gives a teacher a password; one who signs in with Google
  // alone has none to change.
  if (!(await hasPassword(user.id))) {
    return failure("You sign in with Google, so there's no password to change.");
  }
  if (!user.mustChangePassword) {
    if (!currentPassword || !(await isPassword(user.id, currentPassword))) {
      return failure("Check the highlighted fields.", {
        currentPassword: ["That isn't your password now."],
      });
    }
  }

  const teacher = await prisma.teacher.findUniqueOrThrow({
    where: { id: user.teacherId },
    select: { number: true },
  });
  const problem = teacherPasswordProblem(newPassword, teacher);
  if (problem) return failure("Check the highlighted fields.", { newPassword: [problem] });
  if (await isPassword(user.id, newPassword)) {
    return failure("Check the highlighted fields.", {
      newPassword: [
        user.mustChangePassword
          ? "Choose a password of your own, not the one from the admin."
          : "That's your password already. Choose a new one.",
      ],
    });
  }

  await setPassword(user.id, newPassword, { temporary: false });
  const session = await auth.api.getSession({ headers: await headers() });
  await endSessions(user.id, { except: session?.session.id });
  await recordTeacherLogin(user.teacherId, "PASSWORD_CHANGED", user.id);

  return success("Password changed.");
}

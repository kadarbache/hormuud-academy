"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { hasPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { isMadeUpEmail, teacherLoginEmail } from "@/lib/teacher-logins";
import {
  failure,
  invalid,
  isUniqueViolation,
  success,
  type ActionResult,
} from "@/lib/action-result";
import { formObject, requiredText } from "@/lib/validation";

const password = z
  .string({ error: "Enter a password." })
  .min(8, "Use at least 8 characters.")
  .max(128, "Keep it under 128 characters.");

const accountSchema = z
  .object({
    name: requiredText("Enter the person's name.", 100),
    // The person's Google address: they sign in with Google, not a password.
    // A teacher may have none and sign in with their Teacher ID instead.
    email: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((email) => email || undefined),
    role: z.enum(["admin", "staff", "teacher"], { error: "Pick a role." }),
    branchId: z.string().optional(),
    teacherId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.email) {
      if (value.role !== "teacher") {
        ctx.addIssue({ code: "custom", path: ["email"], message: "Enter the person's Gmail address." });
      }
    } else if (!z.email().safeParse(value.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address." });
    } else if (isMadeUpEmail(value.email)) {
      // Those stand for a Student ID or a Teacher ID at sign-in.
      ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a real Gmail address." });
    }
    if (value.role === "staff" && !value.branchId) {
      ctx.addIssue({
        code: "custom",
        path: ["branchId"],
        message: "Pick the branch this person works at.",
      });
    }
    if (value.role === "teacher" && !value.teacherId) {
      ctx.addIssue({ code: "custom", path: ["teacherId"], message: "Pick the teacher this login is for." });
    }
  });

type Account = z.infer<typeof accountSchema>;

const emailTaken = failure("Check the highlighted fields.", {
  email: ["There's already an account with this email."],
});

/**
 * Whether the branch or teacher the account is for can have it: an active
 * branch for branch staff, and for a teacher, an active teacher with no other
 * login. `accountId` is the account being edited, which may already have it.
 */
async function checkPlace({ role, branchId, teacherId }: Account, accountId?: string) {
  if (role === "staff") {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    return branch?.active
      ? null
      : failure("Check the highlighted fields.", { branchId: ["Pick an active branch."] });
  }
  if (role === "teacher") {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { active: true, login: { select: { id: true, email: true } } },
    });
    // An account keeps the teacher it's for, even one deactivated since, so
    // its name and address can still be corrected.
    const keepsItsTeacher = accountId !== undefined && teacher?.login?.id === accountId;
    if (!teacher || (!teacher.active && !keepsItsTeacher)) {
      return failure("Check the highlighted fields.", { teacherId: ["Pick an active teacher."] });
    }
    if (teacher.login && teacher.login.id !== accountId) {
      return failure("Check the highlighted fields.", {
        teacherId: [
          isMadeUpEmail(teacher.login.email)
            ? "This teacher already has a login."
            : `This teacher already logs in as ${teacher.login.email}.`,
        ],
      });
    }
  }
  return null;
}

/** Only branch staff have a branch, and only a teacher's login names a teacher. */
function placeOf({ role, branchId, teacherId }: Account) {
  return {
    branchId: role === "staff" ? branchId : null,
    teacherId: role === "teacher" ? teacherId : null,
  };
}

/**
 * The email the account is saved with: the Gmail address, or for a teacher
 * without one, the made-up address their Teacher ID stands for.
 */
async function loginEmailOf({ email, teacherId }: Account) {
  if (email) return email;
  const teacher = await prisma.teacher.findUniqueOrThrow({
    where: { id: teacherId },
    select: { number: true },
  });
  return teacherLoginEmail(teacher.number);
}

export async function createStaffAccount(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = accountSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { name, role } = parsed.data;
  const placeProblem = await checkPlace(parsed.data);
  if (placeProblem) return placeProblem;
  const email = await loginEmailOf(parsed.data);

  try {
    // No password: the person signs in with the Google account that has this
    // email. Marked verified because the admin chose it, and Better Auth
    // links a Google sign-in only to a verified email. A teacher's password
    // is given afterwards, on their row.
    await auth.api.createUser({
      body: {
        name,
        email,
        role,
        // Admins work across all branches, so they never have one.
        data: { ...placeOf(parsed.data), emailVerified: true },
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code?.startsWith("USER_ALREADY_EXISTS")) {
      return emailTaken;
    }
    throw error;
  }

  refresh();
  if (isMadeUpEmail(email)) {
    return success(
      `Login made for ${name}. They have no Gmail, so press Give password on their row and hand it to them.`,
    );
  }
  return success(`Account created for ${name}. Tell them to sign in with Google as ${email}.`);
}

export async function updateStaffAccount(id: string, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = accountSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { name, role } = parsed.data;

  // An admin who demotes themselves could leave the college with no admin.
  if (id === admin.id && role !== "admin") {
    return failure("You can't take away your own admin role. Ask another admin.");
  }
  const placeProblem = await checkPlace(parsed.data, id);
  if (placeProblem) return placeProblem;
  const email = await loginEmailOf(parsed.data);

  const before = await prisma.user.findUniqueOrThrow({ where: { id }, select: { email: true } });
  const emailChanged = before.email !== email;
  try {
    await prisma.user.update({
      where: { id },
      // Saving confirms the email, the same as creating the account does.
      // Accounts made before Google sign-in get ready for it this way.
      data: { name, email, emailVerified: true, role, ...placeOf(parsed.data) },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return emailTaken;
    throw error;
  }

  if (emailChanged) {
    // The Google account linked to the old email would otherwise still get
    // in. A new email usually means the old Google account is lost or was
    // wrong, so end the sessions it opened too.
    await prisma.account.deleteMany({ where: { userId: id, providerId: "google" } });
    const requestHeaders = await headers();
    if (id === admin.id) {
      await auth.api.revokeOtherSessions({ headers: requestHeaders });
    } else {
      await auth.api.revokeUserSessions({ body: { userId: id }, headers: requestHeaders });
    }
  }

  refresh();
  if (!emailChanged) return success("Account saved.");
  if (!isMadeUpEmail(email)) {
    return success(`Account saved. ${name} now signs in with Google as ${email}.`);
  }
  return success(
    (await hasPassword(id))
      ? `Account saved. ${name} now signs in with their Teacher ID and password only.`
      : `Account saved. ${name} has no Gmail now, so press Give password on their row and hand it to them.`,
  );
}

/** Only for accounts that still have a password from before Google sign-in. */
export async function resetStaffPassword(id: string, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ password }).safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  // A teacher gets a temporary password instead, from Give password on their
  // row, which they then replace with their own.
  const account = await prisma.user.findUnique({ where: { id }, select: { teacherId: true } });
  if (account?.teacherId) return failure("Use Reset password on the teacher's row.");
  // Better Auth would add a password to a Google-only account, and nobody on
  // staff gets a new one.
  if (!(await hasPassword(id))) {
    return failure("This person signs in with Google, so there's no password to change.");
  }

  const requestHeaders = await headers();
  await auth.api.setUserPassword({
    body: { userId: id, newPassword: parsed.data.password },
    headers: requestHeaders,
  });
  // A reset often means someone else knows the old password, so end every
  // session that was opened with it. An admin resetting their own password
  // keeps the session they're using.
  if (id === admin.id) {
    await auth.api.revokeOtherSessions({ headers: requestHeaders });
  } else {
    await auth.api.revokeUserSessions({ body: { userId: id }, headers: requestHeaders });
  }

  return success("Password changed and the person was logged out. Give them the new password.");
}

/** Deactivating bans the account in Better Auth, which also logs it out everywhere. */
export async function setStaffActive(id: string, active: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (id === admin.id) return failure("You can't deactivate your own account.");

  // A deactivated teacher's login stays off: it goes back on with the teacher.
  if (active) {
    const account = await prisma.user.findUnique({
      where: { id },
      select: { teacher: { select: { name: true, active: true } } },
    });
    if (account?.teacher && !account.teacher.active) {
      return failure(`${account.teacher.name} is deactivated. Turn them back on under Teachers first.`);
    }
  }

  const requestHeaders = await headers();
  if (active) {
    await auth.api.unbanUser({ body: { userId: id }, headers: requestHeaders });
  } else {
    await auth.api.banUser({
      body: { userId: id, banReason: "Deactivated by an admin" },
      headers: requestHeaders,
    });
  }

  refresh();
  return success(active ? "Account turned back on." : "Account deactivated and logged out.");
}

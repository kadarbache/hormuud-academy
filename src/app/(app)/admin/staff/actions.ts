"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
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
    email: z
      .string({ error: "Enter the person's Gmail address." })
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid email address.")),
    role: z.enum(["admin", "staff"], { error: "Pick a role." }),
    branchId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === "staff" && !value.branchId) {
      ctx.addIssue({
        code: "custom",
        path: ["branchId"],
        message: "Pick the branch this person works at.",
      });
    }
  });

const emailTaken = failure("Check the highlighted fields.", {
  email: ["There's already an account with this email."],
});

async function checkBranch(role: "admin" | "staff", branchId?: string) {
  if (role === "admin") return null;
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  return branch?.active
    ? null
    : failure("Check the highlighted fields.", { branchId: ["Pick an active branch."] });
}

export async function createStaffAccount(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = accountSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, role, branchId } = parsed.data;
  const branchProblem = await checkBranch(role, branchId);
  if (branchProblem) return branchProblem;

  try {
    // No password: the person signs in with the Google account that has this
    // email. Marked verified because the admin chose it, and Better Auth
    // links a Google sign-in only to a verified email.
    await auth.api.createUser({
      body: {
        name,
        email,
        role,
        // Admins work across all branches, so they never have one.
        data: { branchId: role === "staff" ? branchId : null, emailVerified: true },
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
  return success(`Account created for ${name}. Tell them to sign in with Google as ${email}.`);
}

export async function updateStaffAccount(id: string, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = accountSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, role, branchId } = parsed.data;

  // An admin who demotes themselves could leave the college with no admin.
  if (id === admin.id && role !== "admin") {
    return failure("You can't take away your own admin role. Ask another admin.");
  }
  const branchProblem = await checkBranch(role, branchId);
  if (branchProblem) return branchProblem;

  const before = await prisma.user.findUniqueOrThrow({ where: { id }, select: { email: true } });
  const emailChanged = before.email !== email;
  try {
    await prisma.user.update({
      where: { id },
      // Saving confirms the email, the same as creating the account does.
      // Accounts made before Google sign-in get ready for it this way.
      data: { name, email, emailVerified: true, role, branchId: role === "staff" ? branchId : null },
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
  return success(
    emailChanged
      ? `Account saved. ${name} now signs in with Google as ${email}.`
      : "Account saved.",
  );
}

/** Only for accounts that still have a password from before Google sign-in. */
export async function resetStaffPassword(id: string, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ password }).safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  // Better Auth would add a password to a Google-only account, and nobody on
  // staff gets a new one.
  const hasPassword = await prisma.account.count({ where: { userId: id, providerId: "credential" } });
  if (!hasPassword) return failure("This person signs in with Google, so there's no password to change.");

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

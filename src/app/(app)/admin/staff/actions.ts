"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { formObject, requiredText } from "@/lib/validation";

const password = z
  .string({ error: "Enter a password." })
  .min(8, "Use at least 8 characters.")
  .max(128, "Keep it under 128 characters.");

const accountSchema = z
  .object({
    name: requiredText("Enter the person's name.", 100),
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

const newAccountSchema = accountSchema.and(
  z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid email address.")),
    password,
  }),
);

async function checkBranch(role: "admin" | "staff", branchId?: string) {
  if (role === "admin") return null;
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  return branch?.active
    ? null
    : failure("Check the highlighted fields.", { branchId: ["Pick an active branch."] });
}

export async function createStaffAccount(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = newAccountSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, password, role, branchId } = parsed.data;
  const branchProblem = await checkBranch(role, branchId);
  if (branchProblem) return branchProblem;

  try {
    await auth.api.createUser({
      body: {
        name,
        email,
        password,
        role,
        // Admins work across all branches, so they never have one.
        data: { branchId: role === "staff" ? branchId : null },
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code?.startsWith("USER_ALREADY_EXISTS")) {
      return failure("Check the highlighted fields.", {
        email: ["There's already an account with this email."],
      });
    }
    throw error;
  }

  refresh();
  return success(`Account created for ${name}. Give them their email and password.`);
}

export async function updateStaffAccount(id: string, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = accountSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { name, role, branchId } = parsed.data;

  // An admin who demotes themselves could leave the college with no admin.
  if (id === admin.id && role !== "admin") {
    return failure("You can't take away your own admin role. Ask another admin.");
  }
  const branchProblem = await checkBranch(role, branchId);
  if (branchProblem) return branchProblem;

  await prisma.user.update({
    where: { id },
    data: { name, role, branchId: role === "staff" ? branchId : null },
  });

  refresh();
  return success("Account saved.");
}

export async function resetStaffPassword(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ password }).safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  await auth.api.setUserPassword({
    body: { userId: id, newPassword: parsed.data.password },
    headers: await headers(),
  });

  return success("Password changed. Give the new password to the person.");
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

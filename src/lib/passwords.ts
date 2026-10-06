import "server-only";
import { randomInt } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Passwords for the logins that have one: students, teachers, and staff
// accounts left over from before Google sign-in. Staff hand out a temporary
// password, and its owner chooses their own the first time they sign in.

// No 0/o, 1/l/i: a password read out at the front desk or copied from paper
// shouldn't have letters that look alike.
const PASSWORD_LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";

/** A temporary password staff read out: 8 lowercase letters and digits. */
export function temporaryPassword() {
  return Array.from({ length: 8 }, () => PASSWORD_LETTERS[randomInt(PASSWORD_LETTERS.length)]).join(
    "",
  );
}

/**
 * Sets the login's password, adding one if it had none (a teacher who has
 * only used Google). A temporary one, from staff, makes its owner choose
 * their own at their next sign-in; `expires` is when it stops working, if
 * ever. The caller ends whichever sessions should end.
 */
export async function setPassword(
  userId: string,
  password: string,
  { temporary, expires = null }: { temporary: boolean; expires?: Date | null },
) {
  const context = await auth.$context;
  const hash = await context.password.hash(password);
  if (await context.internalAdapter.findCredentialAccount(userId)) {
    await context.internalAdapter.updatePassword(userId, hash);
  } else {
    await context.internalAdapter.createAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: hash,
    });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: temporary, temporaryPasswordExpires: temporary ? expires : null },
  });
}

/** Takes the login's password away, so it signs in with Google only. */
export async function removePassword(userId: string) {
  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId, providerId: "credential" } }),
    prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: false, temporaryPasswordExpires: null },
    }),
  ]);
}

/** Whether the login has a password at all. */
export async function hasPassword(userId: string) {
  const count = await prisma.account.count({ where: { userId, providerId: "credential" } });
  return count > 0;
}

/** Whether this is the login's password now. */
export async function isPassword(userId: string, password: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });
  if (!account?.password) return false;
  const context = await auth.$context;
  return context.password.verify({ hash: account.password, password });
}

/** Logs the login out on every device, or every one but the session given. */
export async function endSessions(userId: string, { except }: { except?: string } = {}) {
  await prisma.session.deleteMany({
    where: { userId, ...(except ? { id: { not: except } } : {}) },
  });
}

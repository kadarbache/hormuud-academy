import "server-only";
import { randomInt } from "node:crypto";
import { auth } from "@/lib/auth";
import { formatStudentNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

// A student login is a Better Auth user with the role "student" and the
// student it belongs to. The student signs in with their Student ID; Better
// Auth still wants an email, so the login gets a made-up one built from the
// ID. ".invalid" is reserved and never delivered, so no mail can reach it and
// no Google account can have it.

/** STU-00042's login email: "stu-00042@students.invalid". Never shown. */
export function studentLoginEmail(number: number) {
  return `${formatStudentNumber(number).toLowerCase()}@students.invalid`;
}

// No 0/o, 1/l/i: a password read out at the front desk or copied from paper
// shouldn't have letters that look alike.
const PASSWORD_LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";

/** A temporary password staff read out to the student: 8 lowercase letters and digits. */
export function temporaryPassword() {
  return Array.from({ length: 8 }, () => PASSWORD_LETTERS[randomInt(PASSWORD_LETTERS.length)]).join(
    "",
  );
}

/**
 * Makes the student's login with a temporary password. It goes through the
 * admin plugin's create-user, the only way an account may be made (see the
 * hook in src/lib/auth.ts). Called without the request's headers, so Better
 * Auth doesn't ask whether the staff member is an admin: the caller has
 * already checked they may manage this student's login.
 */
export async function createStudentLogin(
  student: { id: string; number: number; fullName: string },
  password: string,
) {
  await auth.api.createUser({
    body: {
      name: student.fullName,
      email: studentLoginEmail(student.number),
      password,
      role: "student",
      data: { studentId: student.id, mustChangePassword: true },
    },
  });
}

/**
 * Replaces the login's password. A temporary one, from staff, makes the
 * student choose their own at their next sign-in. The caller ends whichever
 * sessions should end.
 */
export async function setStudentPassword(
  userId: string,
  password: string,
  { temporary }: { temporary: boolean },
) {
  const context = await auth.$context;
  await context.internalAdapter.updatePassword(userId, await context.password.hash(password));
  await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: temporary } });
}

/** Whether this is the login's password now. */
export async function isStudentPassword(userId: string, password: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });
  if (!account?.password) return false;
  const context = await auth.$context;
  return context.password.verify({ hash: account.password, password });
}

/** Logs the login out on every phone, or every one but the session given. */
export async function endSessions(userId: string, { except }: { except?: string } = {}) {
  await prisma.session.deleteMany({
    where: { userId, ...(except ? { id: { not: except } } : {}) },
  });
}

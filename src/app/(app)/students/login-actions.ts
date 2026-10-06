"use server";

import { refresh } from "next/cache";
import { APIError } from "better-auth/api";
import type { StudentLoginAction } from "@/generated/prisma/client";
import { failure, isUniqueViolation, success, type ActionResult } from "@/lib/action-result";
import { formatStudentNumber } from "@/lib/format";
import { endSessions, setPassword, temporaryPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { requireStaff, type StaffUser } from "@/lib/session";
import { createStudentLogin } from "@/lib/student-logins";
import { browsableStudents } from "./access";

// A student's login to the portal. The admin, and staff at any branch the
// student belongs to (their home branch, or one where they take or took a
// skill), make it, give it a new temporary password and turn it off and on.
// Every change is recorded with who made it and at which branch.

/** The student, with their login if they have one, when this user may manage it. */
function manageableStudent(user: StaffUser, id: string) {
  return prisma.student.findFirst({
    where: { id, ...browsableStudents(user) },
    select: {
      id: true,
      number: true,
      fullName: true,
      login: { select: { id: true, banned: true } },
    },
  });
}

const notYours = failure("You can only manage the login of a student at your branch.");

function record(user: StaffUser, studentId: string, action: StudentLoginAction) {
  return prisma.studentLoginEvent.create({
    data: {
      studentId,
      action,
      byId: user.id,
      branchId: user.role === "staff" ? user.branchId : null,
    },
  });
}

/** Makes the login and hands back its temporary password, to show once. */
export async function createLogin(studentId: string): Promise<ActionResult<{ password: string }>> {
  const user = await requireStaff();
  const student = await manageableStudent(user, studentId);
  if (!student) return notYours;
  if (student.login) return failure(`${student.fullName} already has a login.`);

  const password = temporaryPassword();
  // Two staff pressing it at once: the second is refused by the unique email.
  try {
    await createStudentLogin(student, password);
  } catch (error) {
    const taken =
      (error instanceof APIError && error.body?.code?.startsWith("USER_ALREADY_EXISTS")) ||
      isUniqueViolation(error);
    if (taken) return failure(`${student.fullName} already has a login.`);
    throw error;
  }
  await record(user, student.id, "CREATED");

  // No refresh: the button showing the password would be replaced while it
  // shows it. It refreshes the page itself once it's closed.
  return success(undefined, { password });
}

/** A new temporary password, for a student who forgot theirs. Logs them out everywhere. */
export async function resetLoginPassword(
  studentId: string,
): Promise<ActionResult<{ password: string }>> {
  const user = await requireStaff();
  const student = await manageableStudent(user, studentId);
  if (!student) return notYours;
  if (!student.login) return failure(`${student.fullName} has no login yet.`);
  if (student.login.banned) return failure("This login is turned off. Turn it back on first.");

  const password = temporaryPassword();
  await setPassword(student.login.id, password, { temporary: true });
  await endSessions(student.login.id);
  await record(user, student.id, "PASSWORD_RESET");

  // Refreshed by the button once the password is closed, as for createLogin.
  return success(undefined, { password });
}

/**
 * Turning a login off stops the student signing in and logs them out
 * everywhere. Better Auth refuses a sign-in to a banned user, the same as a
 * deactivated staff account.
 */
export async function setLoginActive(studentId: string, active: boolean): Promise<ActionResult> {
  const user = await requireStaff();
  const student = await manageableStudent(user, studentId);
  if (!student) return notYours;
  if (!student.login) return failure(`${student.fullName} has no login yet.`);
  if (student.login.banned === !active) {
    return success(active ? "The login is already on." : "The login is already off.");
  }

  await prisma.user.update({
    where: { id: student.login.id },
    data: active
      ? { banned: false, banReason: null, banExpires: null }
      : { banned: true, banReason: "Turned off by staff" },
  });
  if (!active) await endSessions(student.login.id);
  await record(user, student.id, active ? "TURNED_ON" : "TURNED_OFF");

  refresh();
  const id = formatStudentNumber(student.number);
  return success(
    active ? `${id} can sign in again.` : `${id}'s login is off, and they were logged out.`,
  );
}

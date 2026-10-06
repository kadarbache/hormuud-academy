"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionResult } from "@/lib/action-result";
import {
  endSessions,
  hasPassword,
  removePassword,
  setPassword,
  temporaryPassword,
} from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import {
  isMadeUpEmail,
  recordTeacherLogin,
  temporaryPasswordExpiry,
} from "@/lib/teacher-logins";

// A teacher's password, which only the admin hands out, replaces and takes
// away. Every change is recorded with the admin who made it.

/** The login, with its teacher, when it's a teacher's. */
function teacherLogin(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { email: true, banned: true, teacher: { select: { id: true, name: true } } },
  });
}

const notATeacher = failure("Only a teacher's login gets a password here.");

/**
 * Gives the teacher a temporary password, or a new one in place of the one
 * they have, and hands it back to show once. It works for 48 hours, and the
 * teacher chooses their own the first time they sign in with it. A new one
 * logs them out everywhere, since someone else may know the old one.
 */
export async function giveTeacherPassword(
  id: string,
): Promise<ActionResult<{ password: string }>> {
  const admin = await requireAdmin();
  const login = await teacherLogin(id);
  if (!login?.teacher) return notATeacher;
  if (login.banned) return failure("This login is deactivated. Turn it back on first.");

  const replacing = await hasPassword(id);
  const password = temporaryPassword();
  await setPassword(id, password, { temporary: true, expires: temporaryPasswordExpiry() });
  if (replacing) await endSessions(id);
  await recordTeacherLogin(login.teacher.id, replacing ? "PASSWORD_RESET" : "PASSWORD_GIVEN", admin.id);

  // No refresh: the button showing the password would be replaced while it
  // shows it. It refreshes the page itself once it's closed.
  return success(undefined, { password });
}

/**
 * Takes the password away, so the teacher signs in with Google only, and logs
 * them out everywhere. A teacher with no Gmail would be left with no way in,
 * so theirs stays: deactivating is how to stop them.
 */
export async function removeTeacherPassword(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const login = await teacherLogin(id);
  if (!login?.teacher) return notATeacher;
  if (isMadeUpEmail(login.email)) {
    return failure(
      `${login.teacher.name} has no Gmail, so the password is their only way in. Deactivate the account instead.`,
    );
  }
  if (!(await hasPassword(id))) return success(`${login.teacher.name} already signs in with Google only.`);

  await removePassword(id);
  await endSessions(id);
  await recordTeacherLogin(login.teacher.id, "PASSWORD_REMOVED", admin.id);

  refresh();
  return success(`${login.teacher.name} signs in with Google only now, and was logged out.`);
}

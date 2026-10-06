import "server-only";
import type { TeacherLoginAction } from "@/generated/prisma/client";
import { formatTeacherNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

// A teacher login signs in with Google, with its Teacher ID and a password,
// or both. The admin makes it on Staff accounts; one without a Gmail address
// gets a made-up email built from the Teacher ID, the way a student login
// does, so it can only get in with a password.
//
// A teacher login can change attendance, so its password is held to more than
// a student's: it's longer, a temporary one from the admin stops working after
// 48 hours, and every change and sign-in is kept.

/** TCH-00007's made-up login email: "tch-00007@teachers.invalid". Never shown. */
export function teacherLoginEmail(number: number) {
  return `${formatTeacherNumber(number).toLowerCase()}@teachers.invalid`;
}

/**
 * Whether the login's email is one of the made-up ones, which no mail and no
 * Google account can reach: the login has no Gmail address.
 */
export function isMadeUpEmail(email: string) {
  return email.endsWith(".invalid");
}

/** How long a temporary password from the admin keeps working. */
export const TEMPORARY_PASSWORD_HOURS = 48;

export function temporaryPasswordExpiry() {
  return new Date(Date.now() + TEMPORARY_PASSWORD_HOURS * 60 * 60 * 1000);
}

export const TEACHER_PASSWORD_MIN = 10;

/**
 * Why this password won't do for a teacher, or null when it will. Common
 * words are allowed: sign-in allows 5 tries a minute per account, which is
 * what stops a guesser. Only numbers are refused, since that's often a phone
 * number or a date, and so is the Teacher ID, which anyone can read off a
 * screen.
 */
export function teacherPasswordProblem(
  password: string,
  teacher: { number: number },
): string | null {
  if (password.length < TEACHER_PASSWORD_MIN) {
    return `Use at least ${TEACHER_PASSWORD_MIN} characters.`;
  }
  const lower = password.toLowerCase();
  if (lower.replace(/[^a-z]/g, "").length < 3) {
    return "Use some letters, not only numbers. A password of numbers is often a phone number or a date.";
  }
  const id = formatTeacherNumber(teacher.number).toLowerCase();
  if (lower.includes(id) || lower.includes(id.replace("-", ""))) {
    return "Don't put your Teacher ID in your password.";
  }
  return null;
}

/** Keeps one change to a teacher's password, or one sign-in. */
export function recordTeacherLogin(
  teacherId: string,
  action: TeacherLoginAction,
  byId: string,
  ipAddress: string | null = null,
) {
  return prisma.teacherLoginEvent.create({ data: { teacherId, action, byId, ipAddress } });
}

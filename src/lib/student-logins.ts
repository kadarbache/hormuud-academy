import "server-only";
import { auth } from "@/lib/auth";
import { formatStudentNumber } from "@/lib/format";

// A student login is a Better Auth user with the role "student" and the
// student it belongs to. The student signs in with their Student ID; Better
// Auth still wants an email, so the login gets a made-up one built from the
// ID. ".invalid" is reserved and never delivered, so no mail can reach it and
// no Google account can have it. Its password is handled in passwords.ts.

/** STU-00042's login email: "stu-00042@students.invalid". Never shown. */
export function studentLoginEmail(number: number) {
  return `${formatStudentNumber(number).toLowerCase()}@students.invalid`;
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

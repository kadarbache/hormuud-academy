import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/session";

// Who sees which students.
//
// - Admins see everything.
// - Branch staff browse the students registered at their branch or taking a
//   skill there. They can also open any student found by exact ID or phone,
//   so they can enroll a student from another branch without a duplicate.
// - Staff only ever see enrollments at their own branch.
//
// Enrolling, finishing, dropping and recording a payment all happen at the
// skill's own branch: that rule is canActAtBranch in @/lib/access.

/** Enrollments the user may see and act on. */
export function visibleEnrollments(user: CurrentUser): Prisma.EnrollmentWhereInput {
  if (user.role === "admin") return {};
  return { branchSkill: { branchId: user.branchId ?? "" } };
}

/** Students the user can find by name and see in the list without a lookup. */
export function browsableStudents(user: CurrentUser): Prisma.StudentWhereInput {
  if (user.role === "admin") return {};
  const branchId = user.branchId ?? "";
  return {
    OR: [
      { homeBranchId: branchId },
      { enrollments: { some: { branchSkill: { branchId } } } },
    ],
  };
}

/** Profile details change only at the student's home branch, or by an admin. */
export function canEditStudent(user: CurrentUser, student: { homeBranchId: string }) {
  return user.role === "admin" || student.homeBranchId === user.branchId;
}

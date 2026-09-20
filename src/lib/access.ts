import type { CurrentUser } from "@/lib/session";

/**
 * The rule the whole app works by: an admin acts anywhere, and branch staff
 * act only at their own branch. Enrolling a student, recording what they
 * paid and reading a branch's takings all ask this same question.
 */
export function canActAtBranch(user: CurrentUser, branchId: string) {
  return user.role === "admin" || user.branchId === branchId;
}

import type { CurrentUser } from "@/lib/session";

/**
 * The rule the whole app works by: an admin acts anywhere, and branch staff
 * act only at their own branch. Enrolling a student, recording what they
 * paid and reading a branch's takings all ask this same question. A teacher
 * acts at no branch: what they may do is asked of their own class times.
 */
export function canActAtBranch(user: CurrentUser, branchId: string) {
  return user.role === "admin" || (user.role === "staff" && user.branchId === branchId);
}

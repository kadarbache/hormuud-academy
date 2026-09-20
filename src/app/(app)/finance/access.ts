import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/session";

// Who sees which money.
//
// - The admin sees every branch: income, expenses, teacher pay and budgets.
// - Branch staff record what students pay at their own branch and see that
//   branch's income. Expenses, salaries and budgets are the admin's alone,
//   so a branch can't read what the college pays its people.
//
// Recording a payment asks canActAtBranch in @/lib/access, the same rule
// that decides who may enroll a student.

/** Payments the user may see. */
export function visiblePayments(user: CurrentUser): Prisma.PaymentWhereInput {
  if (user.role === "admin") return {};
  return { branchId: user.branchId ?? "" };
}

/**
 * The branch to report on: the one the admin picked, or the staff member's
 * own whatever the query string asks for. Null means every branch.
 */
export function reportBranchId(user: CurrentUser, requested: string): string | null {
  if (user.role !== "admin") return user.branchId ?? "";
  return requested || null;
}

import "server-only";
import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { toDbDate } from "@/lib/dates";

/**
 * The registration fee payment written at the same moment as the enrollment
 * it pays for, when the student hands the money over as they sign up. Paid
 * later, it goes through recordRegistrationFee on the student's page instead.
 *
 * Registration fees earn no teacher share: a percentage teacher is paid out
 * of the monthly fees their students pay, not out of the college's admission
 * charge (see docs/adr/0004).
 */
export function registrationFeePayment(args: {
  studentId: string;
  branchId: string;
  amount: Prisma.Decimal;
  paidOn: string;
  method: PaymentMethod;
  recordedById: string;
}): Prisma.PaymentUncheckedCreateWithoutEnrollmentInput {
  return {
    category: "REGISTRATION_FEE",
    method: args.method,
    amount: args.amount,
    paidOn: toDbDate(args.paidOn),
    branchId: args.branchId,
    studentId: args.studentId,
    recordedById: args.recordedById,
  };
}

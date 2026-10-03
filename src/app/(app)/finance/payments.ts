import "server-only";
import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { toDbDate } from "@/lib/dates";
import { dollarsToShillings, inLedger, type Ledger } from "@/lib/money";

/**
 * The registration fee payment written at the same moment as the enrollment
 * it pays for, when the student hands the money over as they sign up. Paid
 * later, it goes through recordRegistrationFee on the student's page instead.
 *
 * The fee is set in dollars. Paid in shillings, the payment is the fee at the
 * rate in force, to the nearest shilling, and keeps that rate.
 *
 * Registration fees earn no teacher share: a percentage teacher is paid out
 * of the monthly fees their students pay, not out of the college's admission
 * charge (see docs/adr/0004).
 */
export function registrationFeePayment(args: {
  studentId: string;
  branchId: string;
  fee: Prisma.Decimal;
  ledger: Ledger;
  paidOn: string;
  method: PaymentMethod;
  recordedById: string;
}): Prisma.PaymentUncheckedCreateWithoutEnrollmentInput {
  const fee = args.fee.toString();
  const { exchangeRate } = args.ledger;
  return {
    category: "REGISTRATION_FEE",
    method: args.method,
    ...inLedger(exchangeRate ? dollarsToShillings(fee, exchangeRate) : fee, args.ledger),
    paidOn: toDbDate(args.paidOn),
    branchId: args.branchId,
    studentId: args.studentId,
    recordedById: args.recordedById,
  };
}

// The words the financial screens show for each stored code, in one place so
// a dropdown, a table and a total never disagree. Safe to import from client
// components: no database, no session.

import type {
  ExpenseCategory,
  IncomeCategory,
  PaymentMethod,
  SalaryType,
} from "@/generated/prisma/client";
import type { Option } from "@/components/select-input";

/** How money changed hands. Cash first: it's what most payments are. */
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Cash",
  ZAAD: "ZAAD",
  EDAHAB: "eDahab",
  BANK: "Bank / other",
};

export const incomeCategoryLabels: Record<IncomeCategory, string> = {
  REGISTRATION_FEE: "Registration fee",
  MONTHLY_FEE: "Monthly fee",
  BOOKS: "Books",
  EXAMINATION_FEE: "Examination fee",
  OTHER: "Other income",
};

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  TEACHER_SALARY: "Teacher salary",
  STAFF_SALARY: "Staff salary",
  INTERNET: "Internet",
  STATIONERY: "Stationery",
  TRANSPORTATION: "Transportation",
  MAINTENANCE: "Maintenance",
  OTHER: "Other expenses",
};

export const salaryTypeLabels: Record<SalaryType, string> = {
  FIXED: "Fixed salary",
  PERCENTAGE: "Percentage of fees",
};

function toOptions<T extends string>(labels: Record<T, string>): Option[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

export const paymentMethodOptions = toOptions(paymentMethodLabels);
export const incomeCategoryOptions = toOptions(incomeCategoryLabels);
export const expenseCategoryOptions = toOptions(expenseCategoryLabels);
export const salaryTypeOptions = toOptions(salaryTypeLabels);

export const paymentMethods = Object.keys(paymentMethodLabels) as PaymentMethod[];
export const incomeCategories = Object.keys(incomeCategoryLabels) as IncomeCategory[];
export const expenseCategories = Object.keys(expenseCategoryLabels) as ExpenseCategory[];

/**
 * The income a member of staff types in themselves. A registration fee and a
 * monthly fee are always for one skill, so they're recorded on the student's
 * page instead, where the amount and the teacher's share are already known.
 */
export const walkInIncomeCategories = ["BOOKS", "EXAMINATION_FEE", "OTHER"] as const;

export const walkInIncomeOptions = walkInIncomeCategories.map((value) => ({
  value,
  label: incomeCategoryLabels[value],
}));

/** The form field a category's planned amount is submitted under. */
export function lineField(category: ExpenseCategory) {
  return `line_${category}`;
}

/** A filter's "no filter" choice. Radix won't take an empty option value. */
export const ANY = "any";

export function withAnyOption(options: Option[], label: string): Option[] {
  return [{ value: ANY, label }, ...options];
}

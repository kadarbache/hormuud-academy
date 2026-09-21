import "server-only";
import type { IncomeCategory, PaymentMethod, Prisma } from "@/generated/prisma/client";
import { parseStudentLookup } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { one, type SearchParams } from "@/lib/search-params";
import type { CurrentUser } from "@/lib/session";
import { reportBranchId, visiblePayments } from "../access";
import { ANY, incomeCategories, paymentMethods } from "../labels";
import { periodFilter, readPeriod, type Period } from "../period";

export const PAGE_SIZE = 25;

export type IncomeFilters = {
  period: Period;
  /** Empty means every branch. Only an admin ever gets more than their own. */
  branchId: string;
  category: IncomeCategory | "";
  method: PaymentMethod | "";
  teacherId: string;
  /** A student ID, phone or name. */
  q: string;
  page: number;
};

function pick<T extends string>(value: string, allowed: readonly T[]): T | "" {
  return (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

export function readIncomeFilters(params: SearchParams): IncomeFilters {
  const branch = one(params, "branch");
  const page = Number.parseInt(one(params, "page"), 10);
  return {
    period: readPeriod(params),
    branchId: branch === ANY ? "" : branch,
    category: pick(one(params, "category"), incomeCategories),
    method: pick(one(params, "method"), paymentMethods),
    teacherId: one(params, "teacher"),
    q: one(params, "q").trim(),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function incomeWhere(user: CurrentUser, filters: IncomeFilters): Prisma.PaymentWhereInput {
  const conditions: Prisma.PaymentWhereInput[] = [visiblePayments(user)];

  const branchId = reportBranchId(user, filters.branchId);
  if (branchId) conditions.push({ branchId });

  const paidOn = periodFilter(filters.period);
  if (paidOn) conditions.push({ paidOn });

  if (filters.category) conditions.push({ category: filters.category });
  if (filters.method) conditions.push({ method: filters.method });
  if (filters.teacherId) conditions.push({ teacherId: filters.teacherId });

  if (filters.q) {
    const lookup = parseStudentLookup(filters.q);
    if (lookup.kind === "number") {
      conditions.push({ student: { number: lookup.number } });
    } else if (lookup.kind === "phone") {
      conditions.push({
        student: {
          OR: [
            { phone: { endsWith: lookup.phone } },
            { responsiblePhone: { endsWith: lookup.phone } },
          ],
        },
      });
    } else {
      conditions.push({ student: { fullName: { contains: lookup.text, mode: "insensitive" } } });
    }
  }

  return { AND: conditions };
}

export async function listPayments(where: Prisma.PaymentWhereInput, page: number) {
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      // Newest money first, and within a day the newest receipt number.
      orderBy: [{ paidOn: "desc" }, { number: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        branch: { select: { name: true } },
        student: { select: { id: true, number: true, fullName: true } },
        enrollment: { select: { skill: { select: { name: true } } } },
        teacher: { select: { id: true, name: true } },
        recordedBy: { select: { name: true } },
      },
    }),
  ]);

  return { total, rows, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Branches for the admin's branch filter. */
export function branchOptions() {
  return prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/**
 * Teachers who have earned a share, for the admin's teacher filter. A
 * fixed-salary teacher never appears: no payment ever names them.
 */
export async function earningTeacherOptions() {
  const teachers = await prisma.teacher.findMany({
    where: { payments: { some: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return teachers.map((teacher) => ({ value: teacher.id, label: teacher.name }));
}

/** The branches a member of staff may record income at. */
export async function recordableBranches(user: CurrentUser) {
  const branches = await prisma.branch.findMany({
    where: { active: true, ...(user.role === "admin" ? {} : { id: user.branchId ?? "" }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return branches.map((branch) => ({ value: branch.id, label: branch.name }));
}

import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { SelectInput } from "@/components/select-input";
import {
  collegeMonth,
  collegeToday,
  formatDate,
  formatMonth,
  isIsoDate,
  isIsoMonth,
  monthEnd,
  monthStart,
  toDbDate,
} from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { one } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { Breakdown, StatCard, StatRow } from "./figures";
import {
  ANY,
  expenseCategories,
  expenseCategoryLabels,
  incomeCategories,
  incomeCategoryLabels,
  paymentMethodLabels,
  paymentMethods,
  withAnyOption,
} from "./labels";
import {
  expensesByCategory,
  incomeByCategory,
  incomeByMethod,
  netBalance,
  totalExpenses,
  totalIncome,
  totalTeacherShare,
} from "./queries";

export const metadata: Metadata = { title: "Financial dashboard" };

export default async function FinancePage({ searchParams }: PageProps<"/finance">) {
  await requireAdmin();
  const params = await searchParams;

  const requestedDay = one(params, "day");
  const requestedMonth = one(params, "month");
  const requestedBranch = one(params, "branch");
  const day = isIsoDate(requestedDay) ? requestedDay : collegeToday();
  const month = isIsoMonth(requestedMonth) ? requestedMonth : collegeMonth();
  const branchId = requestedBranch === ANY ? "" : requestedBranch;

  const branchScope = branchId ? { branchId } : {};
  const onDay = { ...branchScope, paidOn: toDbDate(day) };
  const inMonth = {
    ...branchScope,
    paidOn: { gte: toDbDate(monthStart(month)), lte: toDbDate(monthEnd(month)) },
  };
  const spentOnDay = { ...branchScope, spentOn: toDbDate(day) };
  const spentInMonth = {
    ...branchScope,
    spentOn: { gte: toDbDate(monthStart(month)), lte: toDbDate(monthEnd(month)) },
  };

  const [
    branches,
    dayByMethod,
    dayExpenses,
    monthByCategory,
    monthExpensesByCategory,
    monthIncome,
    monthTeacherShare,
  ] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    incomeByMethod(onDay),
    totalExpenses(spentOnDay),
    incomeByCategory(inMonth),
    expensesByCategory(spentInMonth),
    totalIncome(inMonth),
    totalTeacherShare(inMonth),
  ]);

  const dayNet = netBalance(dayByMethod.total, dayExpenses);
  const monthNet = netBalance(monthIncome, monthExpensesByCategory.total);
  const branchName = branches.find((branch) => branch.id === branchId)?.name;
  const scope = branchName ?? "the whole college";
  const monthQuery = new URLSearchParams({ period: "month", month });
  if (branchId) monthQuery.set("branch", branchId);
  const dayQuery = new URLSearchParams({ day });
  if (branchId) dayQuery.set("branch", branchId);

  return (
    <>
      <PageHeader
        title="Financial dashboard"
        description={`Where ${scope} stands, on the day and over the month.`}
      />

      <Form action="/finance" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="day">Day</Label>
          <Input id="day" name="day" type="date" defaultValue={day} className="w-44" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="month">Month</Label>
          <Input id="month" name="month" type="month" defaultValue={month} className="w-44" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="branch">Branch</Label>
          <SelectInput
            id="branch"
            name="branch"
            options={withAnyOption(
              branches.map((branch) => ({ value: branch.id, label: branch.name })),
              "Every branch",
            )}
            defaultValue={branchId || ANY}
            className="w-44"
          />
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
        {(branchId || day !== collegeToday() || month !== collegeMonth()) && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/finance">Today</Link>
          </Button>
        )}
      </Form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{formatDate(day)}</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/finance/income?${dayQuery.toString()}`}>
              Every payment that day
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <StatRow columns={5}>
          {paymentMethods.map((method) => (
            <StatCard
              key={method}
              tone="muted"
              label={paymentMethodLabels[method]}
              amount={dayByMethod.byKey[method]}
            />
          ))}
          <StatCard label="Total income" amount={dayByMethod.total} />
        </StatRow>

        <StatRow columns={3}>
          <StatCard label="Income" amount={dayByMethod.total} tone="muted" />
          <StatCard label="Expenses" amount={dayExpenses} tone="muted" />
          <StatCard label="Net balance" amount={dayNet} tone="balance" />
        </StatRow>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{formatMonth(month)}</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/finance/budget?month=${month}`}>
              Against the plan
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <StatRow columns={4}>
          <StatCard label="Income" amount={monthIncome} />
          <StatCard label="Expenses" amount={monthExpensesByCategory.total} />
          <StatCard
            label="Earned by percentage teachers"
            amount={monthTeacherShare}
            tone="muted"
            hint="Their share of the fees paid this month"
          />
          <StatCard label="Net balance" amount={monthNet} tone="balance" />
        </StatRow>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Breakdown
              heading="Income category"
              rows={incomeCategories.map((category) => ({
                key: category,
                label: incomeCategoryLabels[category],
                amount: monthByCategory.byKey[category],
              }))}
              total={monthByCategory.total}
              totalLabel="Total income"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/finance/income?${monthQuery.toString()}`}>
                  Every payment this month
                  <ArrowRight />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={branchId ? `/finance/owed?branch=${branchId}` : "/finance/owed"}>
                  Who still owes
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Breakdown
              heading="Expense category"
              rows={expenseCategories.map((category) => ({
                key: category,
                label: expenseCategoryLabels[category],
                amount: monthExpensesByCategory.byKey[category],
                hint:
                  category === "TEACHER_SALARY" &&
                  Number(monthExpensesByCategory.byKey[category]) > 0
                    ? `Salaries and percentage payouts. Earned this month: ${formatMoney(monthTeacherShare)}`
                    : undefined,
              }))}
              total={monthExpensesByCategory.total}
              totalLabel="Total expenses"
            />
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/finance/expenses?${monthQuery.toString()}`}>
                Every expense this month
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

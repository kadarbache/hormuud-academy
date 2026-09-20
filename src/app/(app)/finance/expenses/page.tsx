import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { SelectInput } from "@/components/select-input";
import { EmptyRow } from "@/components/status-badge";
import { collegeMonth, collegeToday, formatDate, formatMonth, fromDbDate, fromDbMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { Breakdown, StatCard, StatRow } from "../figures";
import {
  ANY,
  expenseCategories,
  expenseCategoryLabels,
  expenseCategoryOptions,
  paymentMethodLabels,
  withAnyOption,
} from "../labels";
import { periodLabel, periodParams, periodPhrase } from "../period";
import { PeriodPicker } from "../period-picker";
import { expensesByCategory, expensesByMethod } from "../queries";
import { createExpense, deleteExpense, updateExpense } from "./actions";
import { ExpenseDialog } from "./expense-dialog";
import {
  branchChoices,
  expenseWhere,
  listExpenses,
  PAGE_SIZE,
  readExpenseFilters,
  teacherChoices,
  type ExpenseFilters,
} from "./queries";

export const metadata: Metadata = { title: "Expenses" };

function pageHref(filters: ExpenseFilters, page: number) {
  const params = new URLSearchParams(periodParams(filters.period));
  if (filters.branchId) params.set("branch", filters.branchId);
  if (filters.category) params.set("category", filters.category);
  if (filters.teacherId) params.set("teacher", filters.teacherId);
  if (page > 1) params.set("page", String(page));
  return `/finance/expenses?${params.toString()}`;
}

export default async function ExpensesPage({ searchParams }: PageProps<"/finance/expenses">) {
  await requireAdmin();
  const filters = readExpenseFilters(await searchParams);
  const where = expenseWhere(filters);
  const today = collegeToday();

  const [byCategory, byMethod, { rows, total, pageCount }, branches, teachers] = await Promise.all([
    expensesByCategory(where),
    expensesByMethod(where),
    listExpenses(where, filters.page),
    branchChoices(),
    teacherChoices(),
  ]);

  const when = periodLabel(filters.period);
  const firstShown = (filters.page - 1) * PAGE_SIZE + 1;
  const filtered = Boolean(filters.branchId || filters.category || filters.teacherId);
  const filteredTeacher = teachers.find((teacher) => teacher.value === filters.teacherId);

  // An inactive branch keeps its old expenses, but nothing new is booked to it.
  const branchOptions = branches
    .filter((branch) => branch.active)
    .map((branch) => ({ value: branch.id, label: branch.name }));
  const newExpense = {
    category: "",
    amount: "",
    method: "CASH",
    spentOn: today,
    branchId: filters.branchId || (branchOptions.length === 1 ? branchOptions[0].value : ""),
    teacherId: "",
    forMonth: collegeMonth(),
    note: "",
  };

  return (
    <>
      <PageHeader title="Expenses" description={`What the college spent, ${when}.`}>
        <ExpenseDialog
          action={createExpense}
          title="Record an expense"
          submitLabel="Record expense"
          branches={branchOptions}
          teachers={teachers}
          defaults={newExpense}
          today={today}
          trigger={
            <Button disabled={branchOptions.length === 0}>
              <Plus />
              Record expense
            </Button>
          }
        />
      </PageHeader>

      <Form
        key={JSON.stringify(filters)}
        action="/finance/expenses"
        className="flex flex-wrap items-end gap-3"
      >
        <PeriodPicker period={filters.period} />

        <div className="grid gap-1.5">
          <Label htmlFor="branch">Branch</Label>
          <SelectInput
            id="branch"
            name="branch"
            options={withAnyOption(
              branches.map((branch) => ({ value: branch.id, label: branch.name })),
              "Every branch",
            )}
            defaultValue={filters.branchId || ANY}
            className="w-44"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="category">Category</Label>
          <SelectInput
            id="category"
            name="category"
            options={withAnyOption(expenseCategoryOptions, "Every category")}
            defaultValue={filters.category || ANY}
            className="w-48"
          />
        </div>

        {teachers.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="teacher">Teacher</Label>
            <SelectInput
              id="teacher"
              name="teacher"
              options={withAnyOption(teachers, "Any teacher")}
              defaultValue={filters.teacherId || ANY}
              className="w-44"
            />
          </div>
        )}

        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {filtered && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/finance/expenses">Clear</Link>
          </Button>
        )}
      </Form>

      <StatRow columns={5}>
        <StatCard label={`Total spent, ${when}`} amount={byCategory.total} />
        <StatCard tone="muted" label="Cash" amount={byMethod.byKey.CASH} />
        <StatCard tone="muted" label="ZAAD" amount={byMethod.byKey.ZAAD} />
        <StatCard tone="muted" label="eDahab" amount={byMethod.byKey.EDAHAB} />
        <StatCard tone="muted" label="Bank / other" amount={byMethod.byKey.BANK} />
      </StatRow>

      <Breakdown
        heading="Expense category"
        rows={expenseCategories.map((category) => ({
          key: category,
          label: expenseCategoryLabels[category],
          amount: byCategory.byKey[category],
        }))}
        total={byCategory.total}
        totalLabel="Total expenses"
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Every expense</h2>
        {filteredTeacher && (
          <p className="text-sm text-muted-foreground">
            Only what was paid to {filteredTeacher.label}.{" "}
            <Link href={`/finance/teacher-pay/${filters.teacherId}`} className="underline">
              See what they have earned
            </Link>
          </p>
        )}

        {rows.length === 0 ? (
          <EmptyRow
            message={
              filtered
                ? "No expenses match these filters."
                : `Nothing has been recorded as spent ${periodPhrase(filters.period)}.`
            }
          />
        ) : (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Spent on</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Paid by</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Recorded by</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{formatDate(expense.spentOn)}</TableCell>
                      <TableCell>
                        <div>{expenseCategoryLabels[expense.category]}</div>
                        <div className="text-xs text-muted-foreground">
                          {expense.teacher
                            ? `${expense.teacher.name}${expense.forMonth ? `, ${formatMonth(fromDbMonth(expense.forMonth))}` : ""}`
                            : expense.note}
                        </div>
                      </TableCell>
                      <TableCell>{expense.branch.name}</TableCell>
                      <TableCell>{paymentMethodLabels[expense.method]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(expense.amount.toString())}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {expense.recordedBy.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <ExpenseDialog
                            action={updateExpense.bind(null, expense.id)}
                            title="Edit expense"
                            submitLabel="Save"
                            branches={branchOptions}
                            teachers={teachers}
                            today={today}
                            defaults={{
                              category: expense.category,
                              amount: expense.amount.toString(),
                              method: expense.method,
                              spentOn: fromDbDate(expense.spentOn),
                              branchId: expense.branchId,
                              teacherId: expense.teacherId ?? "",
                              forMonth: expense.forMonth
                                ? fromDbMonth(expense.forMonth)
                                : collegeMonth(),
                              note: expense.note ?? "",
                            }}
                            trigger={
                              <Button variant="ghost" size="sm">
                                Edit
                              </Button>
                            }
                          />
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            action={deleteExpense.bind(null, expense.id)}
                            confirm={{
                              title: "Remove this expense?",
                              description: `${formatMoney(expense.amount.toString())} comes back out of the books. Use this only for something recorded by mistake.`,
                              confirmLabel: "Remove expense",
                              destructive: true,
                            }}
                          >
                            Remove
                          </ActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {firstShown} to {firstShown + rows.length - 1} of {total}
              </span>
              {pageCount > 1 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={pageHref(filters, filters.page - 1)}
                      aria-disabled={filters.page <= 1}
                      className={filters.page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    >
                      <ChevronLeft />
                      Previous
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={pageHref(filters, filters.page + 1)}
                      aria-disabled={filters.page >= pageCount}
                      className={
                        filters.page >= pageCount ? "pointer-events-none opacity-50" : undefined
                      }
                    >
                      Next
                      <ChevronRight />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}

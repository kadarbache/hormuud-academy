import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SelectInput } from "@/components/select-input";
import { EmptyRow } from "@/components/status-badge";
import { collegeToday, formatDate, formatMonth, fromDbMonth } from "@/lib/dates";
import { formatMoney, formatStudentNumber } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { Breakdown, StatCard, StatRow } from "../figures";
import {
  ANY,
  incomeCategories,
  incomeCategoryLabels,
  incomeCategoryOptions,
  paymentMethodLabels,
  paymentMethodOptions,
  paymentMethods,
  withAnyOption,
} from "../labels";
import { PeriodPicker } from "../period-picker";
import { periodLabel, periodParams, periodPhrase } from "../period";
import { incomeByCategory, incomeByMethod } from "../queries";
import { deletePayment, recordIncome } from "./actions";
import { IncomeDialog } from "./income-dialog";
import {
  branchOptions,
  earningTeacherOptions,
  incomeWhere,
  listPayments,
  PAGE_SIZE,
  readIncomeFilters,
  recordableBranches,
  type IncomeFilters,
} from "./queries";

export const metadata: Metadata = { title: "Income" };

function pageHref(filters: IncomeFilters, page: number) {
  const params = new URLSearchParams(periodParams(filters.period));
  if (filters.branchId) params.set("branch", filters.branchId);
  if (filters.category) params.set("category", filters.category);
  if (filters.method) params.set("method", filters.method);
  if (filters.teacherId) params.set("teacher", filters.teacherId);
  if (filters.q) params.set("q", filters.q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/finance/income?${query}` : "/finance/income";
}

/** What one payment was for, in the words the college uses. */
function paidFor(payment: {
  category: keyof typeof incomeCategoryLabels;
  note: string | null;
  forMonth: Date | null;
  enrollment: { skill: { name: string } } | null;
}) {
  const skill = payment.enrollment?.skill.name;
  if (payment.category === "REGISTRATION_FEE") {
    return { title: skill ?? "Registration fee", detail: "Registration fee" };
  }
  if (payment.category === "MONTHLY_FEE") {
    return {
      title: skill ?? "Monthly fee",
      detail: payment.forMonth ? formatMonth(fromDbMonth(payment.forMonth)) : "Monthly fee",
    };
  }
  return { title: incomeCategoryLabels[payment.category], detail: payment.note };
}

export default async function IncomePage({ searchParams }: PageProps<"/finance/income">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const filters = readIncomeFilters(await searchParams);
  const where = incomeWhere(user, filters);

  const [byMethod, byCategory, { rows, total, pageCount }, branches, recordable, teachers] =
    await Promise.all([
      incomeByMethod(where),
      incomeByCategory(where),
      listPayments(where, filters.page),
      isAdmin ? branchOptions() : [],
      recordableBranches(user),
      // Only the admin sees teacher shares, so only they can filter by one.
      isAdmin ? earningTeacherOptions() : [],
    ]);

  const when = periodLabel(filters.period);
  const firstShown = (filters.page - 1) * PAGE_SIZE + 1;
  const filtered = Boolean(
    filters.branchId || filters.category || filters.method || filters.teacherId || filters.q,
  );
  const filteredTeacher = teachers.find((teacher) => teacher.value === filters.teacherId);

  return (
    <>
      <PageHeader
        title="Income"
        description={
          isAdmin
            ? `Every payment the college took, ${when}.`
            : `What your branch took, ${when}.`
        }
      >
        <IncomeDialog
          action={recordIncome}
          branches={recordable}
          today={collegeToday()}
          trigger={
            <Button disabled={recordable.length === 0}>
              <Plus />
              Record income
            </Button>
          }
        />
      </PageHeader>

      {/* Keyed on the filters so "Clear" puts the inputs back to their defaults. */}
      <Form
        key={JSON.stringify(filters)}
        action="/finance/income"
        className="flex flex-wrap items-end gap-3"
      >
        <PeriodPicker period={filters.period} />

        {isAdmin && (
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
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="category">Category</Label>
          <SelectInput
            id="category"
            name="category"
            options={withAnyOption(incomeCategoryOptions, "Every category")}
            defaultValue={filters.category || ANY}
            className="w-44"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="method">Paid by</Label>
          <SelectInput
            id="method"
            name="method"
            options={withAnyOption(paymentMethodOptions, "Every method")}
            defaultValue={filters.method || ANY}
            className="w-40"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="q">Student</Label>
          <Input
            id="q"
            name="q"
            defaultValue={filters.q}
            placeholder="ID, phone or name"
            className="w-52"
          />
        </div>

        {isAdmin && teachers.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="teacher">Earned a share for</Label>
            <SelectInput
              id="teacher"
              name="teacher"
              options={withAnyOption(teachers, "Any teacher")}
              defaultValue={filters.teacherId || ANY}
              className="w-48"
            />
          </div>
        )}

        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {filtered && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/finance/income">Clear</Link>
          </Button>
        )}
      </Form>

      <StatRow columns={5}>
        <StatCard label={`Total income, ${when}`} amount={byMethod.total} />
        {paymentMethods.map((method) => (
          <StatCard
            key={method}
            tone="muted"
            label={paymentMethodLabels[method]}
            amount={byMethod.byKey[method]}
          />
        ))}
      </StatRow>

      <Breakdown
        heading="Income category"
        rows={incomeCategories.map((category) => ({
          key: category,
          label: incomeCategoryLabels[category],
          amount: byCategory.byKey[category],
        }))}
        total={byCategory.total}
        totalLabel="Total income"
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payments</h2>
        {filteredTeacher && (
          <p className="text-sm text-muted-foreground">
            Only the payments that earned {filteredTeacher.label} a share.{" "}
            <Link href={`/finance/teacher-pay/${filters.teacherId}`} className="underline">
              See what they are owed
            </Link>
          </p>
        )}

        {rows.length === 0 ? (
          <EmptyRow
            message={
              filtered
                ? "No payments match these filters."
                : `No payments were recorded ${periodPhrase(filters.period)}.`
            }
          />
        ) : (
          <>
            <DataTable
              columns={[
                { label: "Receipt", className: "font-mono text-xs text-muted-foreground" },
                { label: "Date" },
                { label: "Student" },
                { label: "For" },
                ...(isAdmin ? [{ label: "Branch" }] : []),
                { label: "Paid by" },
                { label: "Amount", className: "text-right tabular-nums" },
                ...(isAdmin ? [{ label: "Teacher share", className: "text-right tabular-nums" }] : []),
                { label: "Recorded by", className: "text-muted-foreground" },
                ...(isAdmin ? [{ label: "Actions", actions: true }] : []),
              ]}
              rows={rows.map((payment) => {
                const what = paidFor(payment);
                return {
                  key: payment.id,
                  title: `Receipt ${payment.number}`,
                  description: `${formatMoney(payment.amount.toString())} on ${formatDate(payment.paidOn)}`,
                  cells: {
                    Receipt: payment.number,
                    Date: formatDate(payment.paidOn),
                    Student: payment.student ? (
                      <>
                        <Link
                          href={`/students/${payment.student.id}`}
                          className="font-medium hover:underline"
                        >
                          {payment.student.fullName}
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">
                          {formatStudentNumber(payment.student.number)}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not a student</span>
                    ),
                    For: (
                      <>
                        <div>{what.title}</div>
                        {what.detail && (
                          <div className="text-xs text-muted-foreground">{what.detail}</div>
                        )}
                      </>
                    ),
                    Branch: payment.branch.name,
                    "Paid by": paymentMethodLabels[payment.method],
                    Amount: formatMoney(payment.amount.toString()),
                    "Teacher share": payment.teacherShare ? (
                      <Link
                        href={`/finance/teacher-pay/${payment.teacherId}`}
                        className="hover:underline"
                      >
                        {formatMoney(payment.teacherShare.toString())}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    ),
                    "Recorded by": payment.recordedBy.name,
                    Actions: (
                      <div className="flex justify-end">
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          action={deletePayment.bind(null, payment.id)}
                          confirm={{
                            title: `Remove receipt ${payment.number}?`,
                            description: `${formatMoney(payment.amount.toString())} comes out of the books, and out of any teacher's share it earned. Use this only for a payment recorded by mistake.`,
                            confirmLabel: "Remove payment",
                            destructive: true,
                          }}
                        >
                          Remove
                        </ActionButton>
                      </div>
                    ),
                  },
                };
              })}
            />

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

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { EmptyRow } from "@/components/status-badge";
import { collegeMonth, collegeToday, formatDate, formatMonth, fromDbMonth } from "@/lib/dates";
import { currentRate } from "@/lib/exchange-rate";
import { formatBoth, formatMoney, formatStudentNumber } from "@/lib/format";
import { ZERO_TOTAL } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { expenseCategoryOptions, listExpenseCategories } from "../../expense-categories/queries";
import { createExpense } from "../../expenses/actions";
import { ExpenseDialog } from "../../expenses/expense-dialog";
import { branchChoices, teacherChoices } from "../../expenses/queries";
import { Amount, Breakdown, StatCard, StatRow } from "../../figures";
import { paymentMethodLabels, salaryTypeLabels, TEACHER_SALARY_ID } from "../../labels";
import { payDefaults } from "../pay";
import { getTeacherPay } from "../queries";

export async function generateMetadata({
  params,
}: PageProps<"/finance/teacher-pay/[id]">): Promise<Metadata> {
  const { id } = await params;
  const teacher = await prisma.teacher.findUnique({ where: { id }, select: { name: true } });
  return { title: teacher ? `${teacher.name} — pay` : "Teacher pay" };
}

export default async function TeacherPayDetailPage({
  params,
}: PageProps<"/finance/teacher-pay/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const pay = await getTeacherPay(id);
  if (!pay) notFound();

  const { teacher, payments, payouts, earnedEver, paidEver, unpaidShare, earningsByBranch } = pay;
  const byPercentage = teacher.salaryType === "PERCENTAGE";
  const today = collegeToday();
  const [branches, teacherOptions, categories, rate] = await Promise.all([
    branchChoices(),
    teacherChoices(),
    listExpenseCategories(),
    currentRate(),
  ]);
  const branchOptions = branches
    .filter((branch) => branch.active)
    .map((branch) => ({ value: branch.id, label: branch.name }));
  const salary = formatMoney(teacher.fixedSalary?.toString() ?? "0", teacher.salaryCurrency);
  const payNow = payDefaults({
    salaryType: teacher.salaryType,
    fixedSalary: teacher.fixedSalary?.toString() ?? "0",
    salaryCurrency: teacher.salaryCurrency,
    unpaidShare,
  });

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/finance/teacher-pay">
          <ChevronLeft />
          Teacher pay
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{teacher.name}</h1>
          <p className="text-sm text-muted-foreground">
            {salaryTypeLabels[teacher.salaryType]}
            {byPercentage
              ? teacher.percentageRate
                ? `, ${teacher.percentageRate}% of every monthly fee their students pay`
                : ", no rate set yet"
              : `, ${salary} a month`}
            {". "}
            {teacher.branches.map((link) => link.branch.name).join(", ")}
          </p>
        </div>
        <ExpenseDialog
          action={createExpense}
          title={`Pay ${teacher.name}`}
          description={
            byPercentage
              ? `${teacher.name}'s unpaid share is ${formatBoth(unpaidShare)}.`
              : `Their salary is ${salary} a month.`
          }
          submitLabel="Record payment"
          categories={expenseCategoryOptions(categories)}
          branches={branchOptions}
          teachers={teacherOptions}
          rate={rate}
          today={today}
          defaults={{
            categoryId: TEACHER_SALARY_ID,
            ...payNow,
            method: "CASH",
            spentOn: today,
            branchId: branchOptions.length === 1 ? branchOptions[0].value : "",
            teacherId: teacher.id,
            forMonth: collegeMonth(),
            note: "",
          }}
          trigger={<Button disabled={branchOptions.length === 0}>Pay this teacher</Button>}
        />
      </div>

      <StatRow columns={3}>
        <StatCard
          label="Earned from fees, in total"
          amount={earnedEver}
          hint={byPercentage ? "Their share of every fee paid" : "Fixed salary, so nothing is earned per fee"}
        />
        <StatCard label="Paid to them, in total" amount={paidEver} tone="muted" />
        <StatCard
          label="Unpaid share"
          amount={byPercentage ? unpaidShare : ZERO_TOTAL}
          tone="balance"
          hint={byPercentage ? "Earned minus paid out" : "Fixed salaries are paid on schedule"}
        />
      </StatRow>

      {byPercentage && earningsByBranch.length > 0 && (
        <Breakdown
          heading="Earned at"
          rows={earningsByBranch.map((row) => ({
            key: row.branchId,
            label: row.branchName,
            amount: row.amount,
          }))}
          total={earnedEver}
          totalLabel="Earned in total"
        />
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Payments that earned them a share</h2>
          <p className="text-sm text-muted-foreground">
            The most recent 100. Every one is a monthly fee a student paid for a skill this
            teacher runs.
          </p>
        </div>

        {payments.length === 0 ? (
          <EmptyRow
            message={
              byPercentage
                ? "No fees have earned this teacher a share yet."
                : "This teacher is on a fixed salary, so student payments don't add to their pay."
            }
          />
        ) : (
          <DataTable
            columns={[
              { label: "Date" },
              { label: "Student" },
              { label: "Skill" },
              { label: "Month" },
              { label: "Branch" },
              { label: "Student paid", className: "text-right tabular-nums" },
              { label: "Their share", className: "text-right tabular-nums" },
            ]}
            rows={payments.map((payment) => ({
              key: payment.id,
              title: formatMoney(payment.teacherShare?.toString() ?? "0", payment.currency),
              description: `Their share of ${formatMoney(payment.amount.toString(), payment.currency)} on ${formatDate(payment.paidOn)}`,
              cells: {
                Date: formatDate(payment.paidOn),
                Student: (
                  <>
                    {payment.student ? (
                      <Link
                        href={`/students/${payment.student.id}`}
                        className="font-medium hover:underline"
                      >
                        {payment.student.fullName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">No student</span>
                    )}
                    {payment.student && (
                      <div className="font-mono text-xs text-muted-foreground">
                        {formatStudentNumber(payment.student.number)}
                      </div>
                    )}
                  </>
                ),
                Skill: payment.enrollment?.skill.name ?? "—",
                Month: payment.forMonth ? formatMonth(fromDbMonth(payment.forMonth)) : "—",
                Branch: payment.branch.name,
                "Student paid": (
                  <Amount
                    amount={payment.amount}
                    currency={payment.currency}
                    exchangeRate={payment.exchangeRate}
                    usdValue={payment.usdValue}
                  />
                ),
                "Their share": (
                  <>
                    <span>
                      {formatMoney(payment.teacherShare?.toString() ?? "0", payment.currency)}
                    </span>
                    {payment.teacherSharePercent && (
                      <div className="text-xs text-muted-foreground">
                        at {payment.teacherSharePercent.toString()}%
                      </div>
                    )}
                  </>
                ),
              },
            }))}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What they have been paid</h2>

        {payouts.length === 0 ? (
          <EmptyRow message="Nothing has been paid to this teacher yet." />
        ) : (
          <DataTable
            columns={[
              { label: "Paid on" },
              { label: "Covers" },
              { label: "Branch" },
              { label: "Paid by" },
              { label: "Amount", className: "text-right tabular-nums" },
              { label: "Recorded by", className: "text-muted-foreground" },
            ]}
            rows={payouts.map((payout) => ({
              key: payout.id,
              title: formatMoney(payout.amount.toString(), payout.currency),
              description: `Paid on ${formatDate(payout.spentOn)}`,
              cells: {
                "Paid on": formatDate(payout.spentOn),
                Covers: (
                  <>
                    {payout.forMonth ? (
                      <Badge variant="secondary">{formatMonth(fromDbMonth(payout.forMonth))}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Not said</span>
                    )}
                    {payout.note && (
                      <div className="text-xs text-muted-foreground">{payout.note}</div>
                    )}
                  </>
                ),
                Branch: payout.branch.name,
                "Paid by": paymentMethodLabels[payout.method],
                Amount: (
                  <Amount
                    amount={payout.amount}
                    currency={payout.currency}
                    exchangeRate={payout.exchangeRate}
                    usdValue={payout.usdValue}
                  />
                ),
                "Recorded by": payout.recordedBy.name,
              },
            }))}
          />
        )}
      </section>
    </>
  );
}

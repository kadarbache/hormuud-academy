import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { collegeMonth, formatMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { isPositiveMoney } from "@/lib/money";
import { requireTeacher } from "@/lib/session";
import { Breakdown, StatCard, StatRow } from "../finance/figures";
import { PayoutsTable, SharePaymentsTable } from "../finance/teacher-pay/pay-tables";
import { getTeacherPay, paidForMonth } from "../finance/teacher-pay/queries";

export const metadata: Metadata = { title: "My pay" };

/**
 * A teacher's own pay, read-only: what the admin sees on their Teacher pay
 * page, without the Pay button or the links to staff pages.
 */
export default async function MyPayPage() {
  const user = await requireTeacher();
  const month = collegeMonth();
  const [pay, paidThisMonth] = await Promise.all([
    getTeacherPay(user.teacherId),
    paidForMonth(user.teacherId, month),
  ]);
  if (!pay) notFound();

  const { teacher, payments, payouts, earnedEver, paidEver, unpaidShare, earningsByBranch } = pay;
  const byPercentage = teacher.salaryType === "PERCENTAGE";
  const salarySet = teacher.fixedSalary !== null && isPositiveMoney(teacher.fixedSalary.toString());
  const salary = formatMoney(teacher.fixedSalary?.toString() ?? "0", teacher.salaryCurrency);

  return (
    <>
      <PageHeader
        title="My pay"
        description={
          byPercentage
            ? teacher.percentageRate
              ? `You earn ${teacher.percentageRate}% of every monthly fee your students pay, and the college pays it out at the end of the month.`
              : "You're paid a percentage of your students' monthly fees, but the admin hasn't set it yet."
            : salarySet
              ? `Your salary is ${salary} a month, paid at the end of the month.`
              : "You're paid a fixed salary, but the admin hasn't set it yet."
        }
      />

      {byPercentage ? (
        <StatRow columns={3}>
          <StatCard label="Earned from fees, in total" amount={earnedEver} hint="Your share of every fee paid" />
          <StatCard label="Paid to you, in total" amount={paidEver} tone="muted" />
          <StatCard
            label="Unpaid share"
            amount={unpaidShare}
            tone="balance"
            hint="Earned minus paid: what the college still has to pay you"
          />
        </StatRow>
      ) : (
        <StatRow columns={3}>
          <StatCard
            label={`Paid for ${formatMonth(month)}`}
            amount={paidThisMonth}
            hint={salarySet ? `Out of ${salary}` : undefined}
          />
          <StatCard label="Paid to you, in total" amount={paidEver} tone="muted" />
        </StatRow>
      )}

      {byPercentage && earningsByBranch.length > 1 && (
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

      {(byPercentage || payments.length > 0) && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Fees that earned you a share</h2>
            <p className="text-sm text-muted-foreground">
              The most recent 100. Each one is a monthly fee a student in your class paid.
            </p>
          </div>

          {payments.length === 0 ? (
            <EmptyRow message="No fees have earned you a share yet." />
          ) : (
            <SharePaymentsTable payments={payments} shareLabel="Your share" linkStudents={false} />
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What you have been paid</h2>

        {payouts.length === 0 ? (
          <EmptyRow message="Nothing has been paid to you yet." />
        ) : (
          <PayoutsTable payouts={payouts} showRecordedBy={false} />
        )}
      </section>
    </>
  );
}

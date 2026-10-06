import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { formatDate, formatMonth, fromDbMonth } from "@/lib/dates";
import { formatMoney, formatStudentNumber } from "@/lib/format";
import { Amount } from "../figures";
import { paymentMethodLabels } from "../labels";
import type { getTeacherPay } from "./queries";

// The two lists on a teacher's pay page. The admin sees them for any teacher
// on Teacher pay, and a teacher sees their own on My pay, with nothing that
// leads to a staff page.

type TeacherPay = NonNullable<Awaited<ReturnType<typeof getTeacherPay>>>;

/** The monthly fees that earned a teacher a share, with what each one earned. */
export function SharePaymentsTable({
  payments,
  shareLabel,
  linkStudents,
}: {
  payments: TeacherPay["payments"];
  /** "Their share" for the admin, "Your share" for the teacher. */
  shareLabel: string;
  /** Student names open the student's page, which only staff can. */
  linkStudents: boolean;
}) {
  return (
    <DataTable
      columns={[
        { label: "Date" },
        { label: "Student" },
        { label: "Skill" },
        { label: "Month" },
        { label: "Branch" },
        { label: "Student paid", className: "text-right tabular-nums" },
        { label: shareLabel, className: "text-right tabular-nums" },
      ]}
      rows={payments.map((payment) => ({
        key: payment.id,
        title: formatMoney(payment.teacherShare?.toString() ?? "0", payment.currency),
        description: `${shareLabel} of ${formatMoney(payment.amount.toString(), payment.currency)} on ${formatDate(payment.paidOn)}`,
        cells: {
          Date: formatDate(payment.paidOn),
          Student: (
            <>
              {!payment.student ? (
                <span className="text-muted-foreground">No student</span>
              ) : linkStudents ? (
                <Link href={`/students/${payment.student.id}`} className="font-medium hover:underline">
                  {payment.student.fullName}
                </Link>
              ) : (
                <span className="font-medium">{payment.student.fullName}</span>
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
          [shareLabel]: (
            <>
              <span>{formatMoney(payment.teacherShare?.toString() ?? "0", payment.currency)}</span>
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
  );
}

/** Every salary and payout paid to a teacher, newest first. */
export function PayoutsTable({
  payouts,
  showRecordedBy,
}: {
  payouts: TeacherPay["payouts"];
  /** Which staff account recorded each one, for the admin. */
  showRecordedBy: boolean;
}) {
  return (
    <DataTable
      columns={[
        { label: "Paid on" },
        { label: "Covers" },
        { label: "Branch" },
        { label: "Paid by" },
        { label: "Amount", className: "text-right tabular-nums" },
        ...(showRecordedBy ? [{ label: "Recorded by", className: "text-muted-foreground" }] : []),
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
              {payout.note && <div className="text-xs text-muted-foreground">{payout.note}</div>}
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
  );
}

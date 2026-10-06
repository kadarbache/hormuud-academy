import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { collegeToday, formatDate, formatMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { toCents } from "@/lib/money";
import { requireStudent } from "@/lib/session";
import { feeSchedule } from "../../(app)/students/fee-schedule";
import { UnpaidNotice, warning } from "../parts";
import { getPortalFees } from "../queries";

export const metadata: Metadata = { title: "My fees" };

/**
 * Each skill's registration fee and every month it has a fee for, paid or
 * not. The same months and total staff see on the student's page: both come
 * from feeSchedule.
 */
export default async function MyFeesPage() {
  const user = await requireStudent();
  const enrollments = await getPortalFees(user.studentId);
  const { rows, owedAltogether } = feeSchedule(enrollments, collegeToday());

  return (
    <>
      <PageHeader
        title="My fees"
        description="Each skill's registration fee, and every month from the one you joined up to this one."
      />

      {Number(owedAltogether) > 0 ? (
        <UnpaidNotice amount={owedAltogether} />
      ) : (
        enrollments.length > 0 && (
          <p className="rounded-lg border bg-card p-4 text-sm">You have no unpaid fees.</p>
        )
      )}

      {rows.length === 0 ? (
        <EmptyRow message="You aren't taking any skills yet, so there are no fees." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ enrollment, free, months, paidCount }) => {
            const registrationFee = enrollment.registrationFee.toString();
            const registrationPaid = enrollment.payments.find(
              (payment) => payment.category === "REGISTRATION_FEE",
            );
            return (
              <Card key={enrollment.id} className="gap-3">
                <CardHeader>
                  <CardTitle>{enrollment.skill.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {enrollment.branchSkill.branch.name}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">Registration fee</span>
                    {Number(registrationFee) === 0 ? (
                      <span className="text-muted-foreground">Nothing to pay</span>
                    ) : registrationPaid ? (
                      <span>
                        {/* Paid in shillings or for less: say what was paid, not the fee. */}
                        Paid{" "}
                        {registrationPaid.currency === "SLSH" ||
                        toCents(registrationPaid.amount.toString()) !== toCents(registrationFee)
                          ? formatMoney(registrationPaid.amount.toString(), registrationPaid.currency)
                          : formatMoney(registrationFee)}{" "}
                        on {formatDate(registrationPaid.paidOn)}
                      </span>
                    ) : (
                      <Badge variant="outline" className={warning}>
                        {formatMoney(registrationFee)} unpaid
                      </Badge>
                    )}
                  </div>

                  {free ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Monthly fee</span>
                      <span>Free</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          Monthly fee, {formatMoney(enrollment.monthlyFee.toString())}
                        </span>
                        {months.length > 0 && (
                          <span className="text-muted-foreground">
                            {paidCount} of {months.length} paid
                          </span>
                        )}
                      </div>
                      {months.length === 0 ? (
                        <p className="text-muted-foreground">Nothing to pay until it starts.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {months.map(({ month, payment }) =>
                            payment ? (
                              <Badge key={month} variant="secondary" className="h-8 px-3">
                                {formatMonth(month)} ·{" "}
                                {formatMoney(payment.amount.toString(), payment.currency)}
                              </Badge>
                            ) : (
                              <Badge
                                key={month}
                                variant="outline"
                                className={`h-8 px-3 ${warning}`}
                              >
                                {formatMonth(month)} · unpaid
                              </Badge>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

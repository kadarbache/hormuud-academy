import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { collegeMonth, collegeToday, formatMonth, isIsoMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { isPositiveMoney, sumMoney } from "@/lib/money";
import { one } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { ExpenseDialog } from "../expenses/expense-dialog";
import { branchChoices, teacherChoices } from "../expenses/queries";
import { createExpense } from "../expenses/actions";
import { StatCard, StatRow } from "../figures";
import { salaryTypeLabels } from "../labels";
import { listTeacherPay } from "./queries";

export const metadata: Metadata = { title: "Teacher pay" };

export default async function TeacherPayPage({ searchParams }: PageProps<"/finance/teacher-pay">) {
  await requireAdmin();
  const requested = one(await searchParams, "month");
  const month = isIsoMonth(requested) ? requested : collegeMonth();
  const today = collegeToday();

  const [teachers, branches, teacherOptions] = await Promise.all([
    listTeacherPay(month),
    branchChoices(),
    teacherChoices(),
  ]);

  const branchOptions = branches
    .filter((branch) => branch.active)
    .map((branch) => ({ value: branch.id, label: branch.name }));

  const percentage = teachers.filter((teacher) => teacher.salaryType === "PERCENTAGE");
  const fixed = teachers.filter((teacher) => teacher.salaryType === "FIXED");
  const owedNow = sumMoney(percentage.map((teacher) => teacher.owed));
  const earnedInMonth = sumMoney(teachers.map((teacher) => teacher.earnedInMonth));
  const paidForMonth = sumMoney(teachers.map((teacher) => teacher.paidForMonth));
  const fixedDue = sumMoney(fixed.filter((t) => t.active).map((teacher) => teacher.fixedSalary));

  return (
    <>
      <PageHeader
        title="Teacher pay"
        description={`What each teacher earned and what they have been paid, for ${formatMonth(month)}.`}
      >
        <ExpenseDialog
          action={createExpense}
          title="Pay a teacher"
          description="This goes into the books as a teacher salary expense."
          submitLabel="Record payment"
          branches={branchOptions}
          teachers={teacherOptions}
          today={today}
          defaults={{
            category: "TEACHER_SALARY",
            amount: "",
            method: "CASH",
            spentOn: today,
            branchId: branchOptions.length === 1 ? branchOptions[0].value : "",
            teacherId: "",
            forMonth: month,
            note: "",
          }}
          trigger={
            <Button disabled={teacherOptions.length === 0 || branchOptions.length === 0}>
              Pay a teacher
            </Button>
          }
        />
      </PageHeader>

      <Form action="/finance/teacher-pay" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="month">Month</Label>
          <Input id="month" name="month" type="month" defaultValue={month} className="w-44" />
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </Form>

      <StatRow>
        <StatCard
          label="Fixed salaries due each month"
          amount={fixedDue}
          hint={`${fixed.filter((t) => t.active).length} teachers on a fixed salary`}
        />
        <StatCard
          label={`Percentage earned, ${formatMonth(month)}`}
          amount={earnedInMonth}
          hint="From the fees paid that month"
        />
        <StatCard
          label={`Paid out for ${formatMonth(month)}`}
          amount={paidForMonth}
          tone="muted"
        />
        <StatCard
          label="Owed to percentage teachers"
          amount={owedNow}
          hint="Earned to date, minus everything paid out"
        />
      </StatRow>

      {teachers.length === 0 ? (
        <EmptyRow message="No teachers yet. Add them on the Teachers screen." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Teaches</TableHead>
                <TableHead className="text-right">Earned {formatMonth(month)}</TableHead>
                <TableHead className="text-right">Paid for {formatMonth(month)}</TableHead>
                <TableHead className="text-right">Owed now</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => {
                const byPercentage = teacher.salaryType === "PERCENTAGE";
                // A fixed teacher is short for the month while what they've
                // been paid for it is under their salary.
                const salaryShort =
                  !byPercentage &&
                  teacher.active &&
                  isPositiveMoney(teacher.fixedSalary) &&
                  Number(teacher.paidForMonth) < Number(teacher.fixedSalary);

                return (
                  <TableRow key={teacher.id}>
                    <TableCell>
                      <Link
                        href={`/finance/teacher-pay/${teacher.id}`}
                        className="font-medium hover:underline"
                      >
                        {teacher.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {teacher.branchNames.join(", ") || "No branch"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{salaryTypeLabels[teacher.salaryType]}</div>
                      <div className="text-xs text-muted-foreground">
                        {byPercentage
                          ? teacher.percentageRate
                            ? `${teacher.percentageRate}% of monthly fees`
                            : "No rate set"
                          : `${formatMoney(teacher.fixedSalary)} a month`}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-normal text-muted-foreground">
                      {teacher.skillNames.join(", ") || "Nothing yet"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {byPercentage ? (
                        formatMoney(teacher.earnedInMonth)
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div>{formatMoney(teacher.paidForMonth)}</div>
                      {salaryShort && (
                        <Badge
                          variant="outline"
                          className="mt-1 border-warning-border bg-warning text-warning-foreground"
                        >
                          Salary not paid in full
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {byPercentage ? (
                        formatMoney(teacher.owed)
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <ExpenseDialog
                          action={createExpense}
                          title={`Pay ${teacher.name}`}
                          description={
                            byPercentage
                              ? `Earned but not yet paid out: ${formatMoney(teacher.owed)}.`
                              : `Their salary is ${formatMoney(teacher.fixedSalary)} a month.`
                          }
                          submitLabel="Record payment"
                          branches={branchOptions}
                          teachers={teacherOptions}
                          today={today}
                          defaults={{
                            category: "TEACHER_SALARY",
                            amount: byPercentage ? teacher.owed : teacher.fixedSalary,
                            method: "CASH",
                            spentOn: today,
                            branchId: branchOptions.length === 1 ? branchOptions[0].value : "",
                            teacherId: teacher.id,
                            forMonth: month,
                            note: "",
                          }}
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={branchOptions.length === 0}
                            >
                              Pay
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

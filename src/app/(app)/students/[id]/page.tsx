import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft, Pencil, Plus, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EmptyRow } from "@/components/status-badge";
import type { Prisma } from "@/generated/prisma/client";
import { canActAtBranch } from "@/lib/access";
import {
  collegeToday,
  formatDate,
  formatMonth,
  fromDbDate,
  fromDbMonth,
  toCollegeDate,
} from "@/lib/dates";
import { formatMoney, formatStudentNumber } from "@/lib/format";
import { sumMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { feeMonths } from "../../finance/fee-months";
import { recordMonthlyFee, recordRegistrationFee } from "../../finance/income/actions";
import { paymentMethodLabels } from "../../finance/labels";
import { canEditStudent } from "../access";
import {
  changeRegistrationFee,
  deleteStudent,
  enrollStudent,
  setEnrollmentStatus,
} from "../actions";
import { enrollableBranchSkills, getStudentProfile } from "../queries";
import { EnrollDialog } from "./enroll-dialog";
import {
  ChangeFeeDialog,
  RecordMonthlyFeeDialog,
  RecordRegistrationFeeDialog,
} from "./fee-dialogs";

export async function generateMetadata({ params }: PageProps<"/students/[id]">): Promise<Metadata> {
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id }, select: { fullName: true } });
  return { title: student?.fullName ?? "Student" };
}

const statusLabel = { ACTIVE: "Active", FINISHED: "Finished", DROPPED: "Dropped" } as const;

const warning = "border-warning-border bg-warning text-warning-foreground";

/** One fee this student paid, as the profile needs it. */
type FeePayment = {
  category: string;
  method: keyof typeof paymentMethodLabels;
  amount: Prisma.Decimal;
  paidOn: Date;
  forMonth: Date | null;
  recordedBy: { name: string };
};

function EnrollmentStatus({ status }: { status: keyof typeof statusLabel }) {
  if (status === "ACTIVE") return <Badge>Active</Badge>;
  if (status === "FINISHED") return <Badge variant="secondary">Finished</Badge>;
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Dropped
    </Badge>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/**
 * One skill's registration fee: the amount, the payment for it if there is
 * one, and the buttons. Staff at the skill's branch record the payment; only
 * the admin changes the fee, and only while nobody has paid it. Taking a
 * payment back happens on the Income screen, where the receipt lives.
 */
function RegistrationFee({
  enrollment,
  payment,
  canRecord,
  isAdmin,
  today,
}: {
  enrollment: { id: string; registrationFee: Prisma.Decimal; skill: { name: string } };
  payment: FeePayment | undefined;
  canRecord: boolean;
  isAdmin: boolean;
  today: string;
}) {
  const fee = enrollment.registrationFee.toString();
  const unpaid = Number(fee) > 0 && !payment;

  return (
    <div className="space-y-1">
      {Number(fee) === 0 ? (
        <div className="text-muted-foreground">Nothing to pay</div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">{formatMoney(fee)}</span>
          {unpaid && (
            <Badge variant="outline" className={warning}>
              Unpaid
            </Badge>
          )}
        </div>
      )}
      {payment && (
        <div className="text-xs text-muted-foreground">
          Paid {formatDate(payment.paidOn)} by {paymentMethodLabels[payment.method]}, recorded by{" "}
          {payment.recordedBy.name}
        </div>
      )}
      {unpaid && (canRecord || isAdmin) && (
        <div className="flex flex-wrap gap-1">
          {canRecord && (
            <RecordRegistrationFeeDialog
              action={recordRegistrationFee.bind(null, enrollment.id)}
              skillName={enrollment.skill.name}
              fee={formatMoney(fee)}
              today={today}
              trigger={
                <Button variant="outline" size="xs">
                  Record payment
                </Button>
              }
            />
          )}
          {isAdmin && (
            <ChangeFeeDialog
              action={changeRegistrationFee.bind(null, enrollment.id)}
              skillName={enrollment.skill.name}
              fee={fee}
              trigger={
                <Button variant="ghost" size="xs">
                  Change fee
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

export default async function StudentPage({ params }: PageProps<"/students/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const profile = await getStudentProfile(user, id);
  if (!profile) notFound();

  const { student, isActive, activeSkillIds } = profile;
  const isAdmin = user.role === "admin";
  const canEdit = canEditStudent(user, student);
  const today = collegeToday();
  const enrollOptions = (
    await enrollableBranchSkills(isAdmin ? undefined : (user.branchId ?? undefined))
  ).filter((option) => !activeSkillIds.includes(option.skillId));

  // Every month each skill owes a fee for, against what has been paid.
  const feeSchedule = student.enrollments.map((enrollment) => {
    const paidByMonth = new Map(
      enrollment.payments
        .filter((payment) => payment.category === "MONTHLY_FEE" && payment.forMonth)
        .map((payment) => [fromDbMonth(payment.forMonth as Date), payment]),
    );
    const months = feeMonths(
      {
        startDate: fromDbDate(enrollment.startDate),
        endDate: fromDbDate(enrollment.endDate),
        status: enrollment.status,
        statusChangedOn: enrollment.statusChangedAt
          ? toCollegeDate(enrollment.statusChangedAt)
          : null,
      },
      today,
    ).map((month) => ({ month, payment: paidByMonth.get(month) }));

    const unpaidMonths = months.filter((row) => !row.payment);
    return {
      enrollment,
      months,
      paidCount: months.length - unpaidMonths.length,
      // What's still owed is the fee they joined at, once per unpaid month.
      owed: sumMoney(unpaidMonths.map(() => enrollment.monthlyFee.toString())),
      collected: sumMoney([...paidByMonth.values()].map((payment) => payment.amount.toString())),
    };
  });

  const registrationOwed = sumMoney(
    student.enrollments
      .filter(
        (enrollment) =>
          Number(enrollment.registrationFee) > 0 &&
          !enrollment.payments.some((payment) => payment.category === "REGISTRATION_FEE"),
      )
      .map((enrollment) => enrollment.registrationFee.toString()),
  );
  const owedAltogether = sumMoney([registrationOwed, ...feeSchedule.map((row) => row.owed)]);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/students">
          <ChevronLeft />
          Students
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={student.photoUrl ?? undefined} alt="" className="object-cover" />
            <AvatarFallback>
              <UserRound className="size-7 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{student.fullName}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">{formatStudentNumber(student.number)}</span>
              {isActive ? (
                <Badge variant="secondary">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Inactive
                </Badge>
              )}
              {Number(owedAltogether) > 0 && (
                <Badge variant="outline" className={warning}>
                  {formatMoney(owedAltogether)} owed
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" asChild>
              <Link href={`/students/${student.id}/edit`}>
                <Pencil />
                Edit details
              </Link>
            </Button>
          )}
          <EnrollDialog
            action={enrollStudent.bind(null, student.id)}
            options={enrollOptions}
            today={today}
            showBranch={isAdmin}
            trigger={
              <Button disabled={enrollOptions.length === 0}>
                <Plus />
                Add skill
              </Button>
            }
          />
          {isAdmin && (
            <ActionButton
              variant="destructive"
              action={deleteStudent.bind(null, student.id)}
              redirectTo="/students"
              confirm={{
                title: `Delete ${student.fullName}?`,
                description:
                  "Only for duplicates and typing mistakes. The student, every skill record they have and every payment they made go for good, which changes the income already recorded for those days.",
                confirmLabel: "Delete student",
                destructive: true,
              }}
            >
              Delete
            </ActionButton>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Sex">{student.sex === "MALE" ? "Male" : "Female"}</Detail>
            <Detail label="Phone">{student.phone ?? "Not given"}</Detail>
            <Detail label="Responsible person's phone">{student.responsiblePhone ?? "Not given"}</Detail>
            <Detail label="Home branch">{student.homeBranch.name}</Detail>
            <Detail label="Registration date">{formatDate(student.registrationDate)}</Detail>
            <Detail label="Registered by">
              {student.createdBy.name}, {formatDate(toCollegeDate(student.createdAt))}
            </Detail>
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Skills</h2>
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">Only skills at your branch are shown.</p>
          )}
        </div>

        {student.enrollments.length === 0 ? (
          <EmptyRow message="No skills here yet." />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Skill</TableHead>
                  <TableHead>Teacher and class</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Registration fee</TableHead>
                  <TableHead className="text-right">Monthly fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.enrollments.map((enrollment) => {
                  const pastEnd =
                    enrollment.status === "ACTIVE" && fromDbDate(enrollment.endDate) < today;
                  const canAct = canActAtBranch(user, enrollment.branchSkill.branchId);
                  return (
                    <TableRow key={enrollment.id}>
                      <TableCell>
                        <div className="font-medium">{enrollment.skill.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {enrollment.branchSkill.branch.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{enrollment.branchSkill.teacher.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {enrollment.branchSkill.classroom.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {formatDate(enrollment.startDate)} to {formatDate(enrollment.endDate)}
                        </div>
                        {pastEnd && (
                          <Badge variant="outline" className={`mt-1 ${warning}`}>
                            Past end date
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <RegistrationFee
                          enrollment={enrollment}
                          payment={enrollment.payments.find(
                            (payment) => payment.category === "REGISTRATION_FEE",
                          )}
                          canRecord={canAct}
                          isAdmin={isAdmin}
                          today={today}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(enrollment.monthlyFee.toString())}
                      </TableCell>
                      <TableCell>
                        <EnrollmentStatus status={enrollment.status} />
                      </TableCell>
                      <TableCell>
                        {canAct && (
                          <div className="flex justify-end gap-1">
                            {enrollment.status === "ACTIVE" ? (
                              <>
                                <ActionButton
                                  variant="ghost"
                                  size="sm"
                                  action={setEnrollmentStatus.bind(null, enrollment.id, "FINISHED")}
                                >
                                  Mark finished
                                </ActionButton>
                                <ActionButton
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  action={setEnrollmentStatus.bind(null, enrollment.id, "DROPPED")}
                                  confirm={{
                                    title: `Drop ${enrollment.skill.name}?`,
                                    description:
                                      "Use this when the student stopped coming before finishing. You can set it active again later.",
                                    confirmLabel: "Drop skill",
                                    destructive: true,
                                  }}
                                >
                                  Drop
                                </ActionButton>
                              </>
                            ) : (
                              <ActionButton
                                variant="ghost"
                                size="sm"
                                action={setEnrollmentStatus.bind(null, enrollment.id, "ACTIVE")}
                                confirm={{
                                  title: `Set ${enrollment.skill.name} active again?`,
                                  description: `It's marked ${statusLabel[enrollment.status].toLowerCase()} now. Use this to undo a mistake.`,
                                  confirmLabel: "Set active",
                                }}
                              >
                                Set active
                              </ActionButton>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {feeSchedule.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Monthly fees</h2>
              <p className="text-sm text-muted-foreground">
                One box per month, from the month the student joined up to this one. Click a month
                they haven&apos;t paid for to record it.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/finance/income?period=all&q=${formatStudentNumber(student.number)}`}>
                Every payment they made
                <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="space-y-3">
            {feeSchedule.map(({ enrollment, months, paidCount, owed, collected }) => {
              const canAct = canActAtBranch(user, enrollment.branchSkill.branchId);
              return (
                <div key={enrollment.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="font-medium">{enrollment.skill.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {formatMoney(enrollment.monthlyFee.toString())} a month at{" "}
                        {enrollment.branchSkill.branch.name}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {paidCount} of {months.length} months paid,{" "}
                      <span className="tabular-nums">{formatMoney(collected)}</span> collected
                      {Number(owed) > 0 && (
                        <>
                          {" · "}
                          <span className="font-medium tabular-nums text-foreground">
                            {formatMoney(owed)} owed
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {months.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      This skill hasn&apos;t started yet, so nothing is owed for it.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {months.map(({ month, payment }) =>
                        payment ? (
                          <Badge
                            key={month}
                            variant="secondary"
                            className="h-8 px-3"
                            title={`Paid ${formatDate(payment.paidOn)} by ${paymentMethodLabels[payment.method]}, recorded by ${payment.recordedBy.name}`}
                          >
                            {formatMonth(month)} · {formatMoney(payment.amount.toString())}
                          </Badge>
                        ) : canAct ? (
                          <RecordMonthlyFeeDialog
                            key={month}
                            action={recordMonthlyFee.bind(null, enrollment.id)}
                            skillName={enrollment.skill.name}
                            month={month}
                            monthLabel={formatMonth(month)}
                            monthlyFee={enrollment.monthlyFee.toString()}
                            today={today}
                            trigger={
                              <Button variant="outline" size="sm" className={warning}>
                                {formatMonth(month)} · unpaid
                              </Button>
                            }
                          />
                        ) : (
                          <Badge key={month} variant="outline" className={`h-8 px-3 ${warning}`}>
                            {formatMonth(month)} · unpaid
                          </Badge>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Plus, UserRound } from "lucide-react";
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
import { collegeToday, formatDate, fromDbDate, toCollegeDate } from "@/lib/dates";
import { formatMoney, formatStudentNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canActAtBranch, canEditStudent } from "../access";
import {
  changeRegistrationFee,
  deleteStudent,
  enrollStudent,
  recordRegistrationFee,
  setEnrollmentStatus,
  undoRegistrationFeePayment,
} from "../actions";
import { enrollableBranchSkills, getStudentProfile } from "../queries";
import { EnrollDialog } from "./enroll-dialog";
import { ChangeFeeDialog, RecordPaymentDialog } from "./registration-fee-dialogs";

export async function generateMetadata({ params }: PageProps<"/students/[id]">): Promise<Metadata> {
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id }, select: { fullName: true } });
  return { title: student?.fullName ?? "Student" };
}

const statusLabel = { ACTIVE: "Active", FINISHED: "Finished", DROPPED: "Dropped" } as const;

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
 * One skill's registration fee: the amount, whether it's paid, and the
 * buttons for it. Staff at the skill's branch record the payment; only the
 * admin changes the fee (while it's unpaid) or takes a payment back.
 */
function RegistrationFee({
  enrollment,
  canRecord,
  isAdmin,
  today,
}: {
  enrollment: {
    id: string;
    registrationFee: Prisma.Decimal;
    registrationFeePaidOn: Date | null;
    registrationFeeRecordedBy: { name: string } | null;
    skill: { name: string };
  };
  canRecord: boolean;
  isAdmin: boolean;
  today: string;
}) {
  const fee = enrollment.registrationFee.toString();
  const paidOn = enrollment.registrationFeePaidOn;
  const unpaid = Number(fee) > 0 && !paidOn;

  return (
    <div className="space-y-1">
      {Number(fee) === 0 ? (
        <div className="text-muted-foreground">Nothing to pay</div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">{formatMoney(fee)}</span>
          {unpaid && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
              Unpaid
            </Badge>
          )}
        </div>
      )}
      {paidOn && (
        <div className="text-xs text-muted-foreground">
          Paid {formatDate(paidOn)}
          {enrollment.registrationFeeRecordedBy &&
            `, recorded by ${enrollment.registrationFeeRecordedBy.name}`}
        </div>
      )}
      {((canRecord && unpaid) || isAdmin) && (
        <div className="flex flex-wrap gap-1">
          {canRecord && unpaid && (
            <RecordPaymentDialog
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
          {isAdmin && !paidOn && (
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
          {isAdmin && paidOn && (
            <ActionButton
              variant="ghost"
              size="xs"
              action={undoRegistrationFeePayment.bind(null, enrollment.id)}
              confirm={{
                title: `Undo the ${enrollment.skill.name} payment?`,
                description:
                  "The registration fee goes back to unpaid. Use this only for a payment recorded by mistake.",
                confirmLabel: "Undo payment",
                destructive: true,
              }}
            >
              Undo payment
            </ActionButton>
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
                  "Only for duplicates and typing mistakes. The student, every skill record they have and the fee payments recorded on them are removed for good.",
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
                          <Badge variant="outline" className="mt-1 border-amber-300 bg-amber-50 text-amber-900">
                            Past end date
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <RegistrationFee
                          enrollment={enrollment}
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
    </>
  );
}

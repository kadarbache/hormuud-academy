import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, UserRound } from "lucide-react";
import type { EnrollmentStatus } from "@/generated/prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { canActAtBranch } from "@/lib/access";
import { formatDays, formatHours, slotOf } from "@/lib/class-times";
import { collegeToday, formatDate, fromDbDate, toDbDate } from "@/lib/dates";
import { formatMoney, formatMonths, formatStudentNumber } from "@/lib/format";
import { isPositiveMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { recentClassDays } from "../../attendance/days";
import { formatShortDay } from "../../attendance/labels";

const warning = "border-warning-border bg-warning text-warning-foreground";

/** How many of its latest days the attendance card offers. */
const RECENT_DAYS = 6;

/** Which of the class time's students to list. Opens on the ones in it now. */
const FILTERS = [
  { value: "active", label: "Active", status: "ACTIVE" },
  { value: "finished", label: "Finished", status: "FINISHED" },
  { value: "dropped", label: "Dropped", status: "DROPPED" },
  { value: "all", label: "All", status: null },
] as const satisfies readonly { value: string; label: string; status: EnrollmentStatus | null }[];

function StatusBadge({ status }: { status: EnrollmentStatus }) {
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

export async function generateMetadata({
  params,
}: PageProps<"/class-times/[id]">): Promise<Metadata> {
  const { id } = await params;
  const classTime = await prisma.classTime.findUnique({
    where: { id },
    select: {
      startMinute: true,
      endMinute: true,
      days: true,
      branchSkill: { select: { skill: { select: { name: true } } } },
    },
  });
  if (!classTime) return { title: "Class time" };
  const slot = slotOf(classTime);
  return { title: `${classTime.branchSkill.skill.name}${slot ? `, ${formatHours(slot)}` : ""}` };
}

/**
 * Everyone studying one skill at one time, with what the class time is: when,
 * where, who teaches it and what it costs, and its last few days' attendance. It's the page behind a class time
 * row on a skill's page and behind the student count on a class's week.
 * Branch staff see only their own branch's class times.
 */
export default async function ClassTimePage({
  params,
  searchParams,
}: PageProps<"/class-times/[id]">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const { id } = await params;
  const { status } = await searchParams;
  const asked = typeof status === "string" ? status : "";
  const filter = FILTERS.find((option) => option.value === asked) ?? FILTERS[0];

  const classTime = await prisma.classTime.findUnique({
    where: { id },
    include: {
      classroom: { select: { id: true, name: true } },
      teacher: { select: { name: true } },
      branchSkill: {
        select: {
          branchId: true,
          skillId: true,
          durationMonths: true,
          registrationFee: true,
          monthlyFee: true,
          skill: { select: { name: true } },
          branch: { select: { name: true } },
        },
      },
    },
  });
  if (!classTime || !canActAtBranch(user, classTime.branchSkill.branchId)) notFound();

  const today = collegeToday();
  const recentDays = recentClassDays(classTime, today, RECENT_DAYS);
  const [enrollments, counts, recentSheets] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classTimeId: id, ...(filter.status ? { status: filter.status } : {}) },
      orderBy: [{ student: { fullName: "asc" } }, { startDate: "asc" }],
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        registrationFee: true,
        payments: { where: { category: "REGISTRATION_FEE" }, select: { id: true } },
        student: {
          select: {
            id: true,
            number: true,
            fullName: true,
            sex: true,
            phone: true,
            responsiblePhone: true,
            photoUrl: true,
          },
        },
      },
    }),
    prisma.enrollment.groupBy({
      by: ["status"],
      where: { classTimeId: id },
      _count: { _all: true },
    }),
    prisma.attendanceSheet.findMany({
      where: { classTimeId: id, date: { in: recentDays.map(toDbDate) } },
      select: { date: true },
    }),
  ]);
  const takenOn = new Set(recentSheets.map((sheet) => fromDbDate(sheet.date)));

  const countOf = (statusOf: EnrollmentStatus) =>
    counts.find((row) => row.status === statusOf)?._count._all ?? 0;
  const total = counts.reduce((sum, row) => sum + row._count._all, 0);
  const filterCount = (option: (typeof FILTERS)[number]) =>
    option.status ? countOf(option.status) : total;

  const bs = classTime.branchSkill;
  const skillName = bs.skill.name;
  const slot = slotOf(classTime);
  const hours = slot ? formatHours(slot) : null;
  const here = `/class-times/${classTime.id}`;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={isAdmin ? `/admin/skills/${bs.skillId}` : `/classes/${classTime.classroom.id}`}>
          <ChevronLeft />
          {isAdmin ? skillName : classTime.classroom.name}
        </Link>
      </Button>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {skillName}
            <span className="font-normal text-muted-foreground">{hours ?? "Time not set"}</span>
            {!classTime.active && (
              <Badge variant="outline" className="text-muted-foreground">
                Deactivated
              </Badge>
            )}
          </span>
        }
        description={`${bs.branch.name}. Everyone studying ${skillName} at this time.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Class time</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Skill">
              {isAdmin ? (
                <Link href={`/admin/skills/${bs.skillId}`} className="hover:underline">
                  {skillName}
                </Link>
              ) : (
                skillName
              )}
            </Detail>
            <Detail label="Branch">{bs.branch.name}</Detail>
            <Detail label="Class">
              <Link href={`/classes/${classTime.classroom.id}`} className="hover:underline">
                {classTime.classroom.name}
              </Link>
            </Detail>
            <Detail label="Teacher">{classTime.teacher.name}</Detail>
            <Detail label="Hours">{hours ?? "Not set"}</Detail>
            <Detail label="Days">
              {classTime.days.length > 0 ? formatDays(classTime.days) : "Not set"}
            </Detail>
            <Detail label="Students">
              {countOf("ACTIVE")} active
              {total > countOf("ACTIVE") && (
                <span className="text-muted-foreground"> · {total} have joined</span>
              )}
            </Detail>
            <Detail label="Course">{formatMonths(bs.durationMonths)}</Detail>
            <Detail label="Registration fee">
              {isPositiveMoney(bs.registrationFee.toString())
                ? formatMoney(bs.registrationFee.toString())
                : "None"}
            </Detail>
            <Detail label="Monthly fee">
              {isPositiveMoney(bs.monthlyFee.toString())
                ? formatMoney(bs.monthlyFee.toString())
                : "Free"}
            </Detail>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          {slot && (
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <Link href={`${here}/attendance`}>By month</Link>
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {slot ? (
            <>
              <div className="flex flex-wrap gap-2">
                {recentDays.map((day) => {
                  const taken = takenOn.has(day);
                  return (
                    <Button
                      key={day}
                      variant={!taken && day === today ? "default" : "outline"}
                      size="sm"
                      asChild
                    >
                      <Link href={`${here}/attendance/${day}`}>
                        {taken && <Check />}
                        {day === today ? "Today" : formatShortDay(day)}
                        {!taken && <span className="font-normal opacity-70">not taken</span>}
                      </Link>
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                The last {RECENT_DAYS} days this class time met. Open one to take its attendance or
                correct it.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No attendance until this class time has hours and days.
              {isAdmin ? " Set them on the skill's page." : " The admin sets them."}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Students</h2>
          <nav aria-label="Which students" className="flex flex-wrap gap-1">
            {FILTERS.map((option) => (
              <Button
                key={option.value}
                variant={option.value === filter.value ? "secondary" : "ghost"}
                size="sm"
                asChild
              >
                <Link
                  href={option.value === "active" ? here : `${here}?status=${option.value}`}
                  aria-current={option.value === filter.value ? "page" : undefined}
                >
                  {option.label} <span className="tabular-nums text-muted-foreground">{filterCount(option)}</span>
                </Link>
              </Button>
            ))}
          </nav>
        </div>

        {enrollments.length === 0 ? (
          <EmptyRow
            message={
              total === 0
                ? "Nobody has joined this class time yet."
                : `No ${filter.label.toLowerCase()} students in this class time.`
            }
          />
        ) : (
          <DataTable
            columns={[
              { label: "Student" },
              { label: "Phone" },
              { label: "Responsible person" },
              { label: "Joined" },
              { label: "Ends" },
              { label: "Registration fee" },
              { label: "Status" },
            ]}
            rows={enrollments.map((enrollment) => {
              const { student } = enrollment;
              const paid = enrollment.payments.length > 0;
              const pastEnd = enrollment.status === "ACTIVE" && fromDbDate(enrollment.endDate) < today;
              return {
                key: enrollment.id,
                title: student.fullName,
                description: `${formatStudentNumber(student.number)} · ${student.sex === "MALE" ? "Male" : "Female"}`,
                cells: {
                  Student: (
                    <Link href={`/students/${student.id}`} className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src={student.photoUrl ?? undefined} alt="" className="object-cover" />
                        <AvatarFallback>
                          <UserRound className="size-4 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium hover:underline">{student.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatStudentNumber(student.number)} · {student.sex === "MALE" ? "Male" : "Female"}
                        </div>
                      </div>
                    </Link>
                  ),
                  Phone: formatPhone(student.phone) || "—",
                  "Responsible person": formatPhone(student.responsiblePhone) || "—",
                  Joined: formatDate(enrollment.startDate),
                  Ends: (
                    <div className="flex flex-wrap items-center gap-1">
                      {formatDate(enrollment.endDate)}
                      {pastEnd && (
                        <Badge variant="outline" className={warning} title="Past its end date and still Active">
                          Past end date
                        </Badge>
                      )}
                    </div>
                  ),
                  "Registration fee": paid ? (
                    <Badge variant="secondary">Paid</Badge>
                  ) : isPositiveMoney(enrollment.registrationFee.toString()) ? (
                    <Badge variant="outline" className={warning}>
                      Unpaid {formatMoney(enrollment.registrationFee.toString())}
                    </Badge>
                  ) : (
                    "None"
                  ),
                  Status: <StatusBadge status={enrollment.status} />,
                },
              };
            })}
          />
        )}
      </section>
    </>
  );
}

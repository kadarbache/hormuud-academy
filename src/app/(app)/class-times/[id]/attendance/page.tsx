import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatHours, slotOf } from "@/lib/class-times";
import { addMonthsToMonth, collegeMonth, collegeToday, formatMonth, isIsoMonth } from "@/lib/dates";
import { formatStudentNumber } from "@/lib/format";
import { one } from "@/lib/search-params";
import { requireSignedIn } from "@/lib/session";
import { cn } from "@/lib/utils";
import { meetsOn } from "../../../attendance/days";
import {
  attendanceRate,
  formatCounts,
  formatRate,
  formatShortDay,
  MARKS,
  markLabel,
  markStyle,
} from "../../../attendance/labels";
import { findClassTime, loadMonth } from "../../../attendance/queries";

export const metadata: Metadata = { title: "Attendance" };

const weekdayOnly = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });

function StudentName({ student }: { student: { fullName: string; number: number } }) {
  return (
    <>
      <div className="font-medium">{student.fullName}</div>
      <div className="text-xs text-muted-foreground">{formatStudentNumber(student.number)}</div>
    </>
  );
}

/**
 * A class time's attendance for one month: a column for each of its days up
 * to today, a row for each student, and each student's rate for the month.
 * A column heading opens that day's sheet. Its teacher sees it too, without
 * the class time's own page or the students' pages behind it.
 */
export default async function ClassTimeAttendancePage({
  params,
  searchParams,
}: PageProps<"/class-times/[id]/attendance">) {
  const user = await requireSignedIn();
  const isTeacher = user.role === "teacher";
  const { id } = await params;
  const asked = one(await searchParams, "month");
  const classTime = await findClassTime(user, id);
  if (!classTime) notFound();

  const today = collegeToday();
  const thisMonth = collegeMonth();
  const month = isIsoMonth(asked) && asked <= thisMonth ? asked : thisMonth;
  const { days, rows } = await loadMonth(classTime, month, today);
  const notTaken = days.filter((day) => !day.taken);
  const skillName = classTime.branchSkill.skill.name;
  const here = `/class-times/${id}/attendance`;
  const slot = slotOf(classTime);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        {isTeacher ? (
          <Link href="/attendance">
            <ChevronLeft />
            Attendance
          </Link>
        ) : (
          <Link href={`/class-times/${id}`}>
            <ChevronLeft />
            {slot ? `${skillName}, ${formatHours(slot)}` : skillName}
          </Link>
        )}
      </Button>

      <PageHeader
        title="Attendance"
        description={`${skillName} in ${classTime.classroom.name} with ${classTime.teacher.name}. ${classTime.branchSkill.branch.name}.`}
      >
        {meetsOn(classTime, today) && (
          <Button asChild>
            <Link href={`${here}/${today}`}>Today&apos;s attendance</Link>
          </Button>
        )}
      </PageHeader>

      <nav aria-label="Month" className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={`${here}?month=${addMonthsToMonth(month, -1)}`} aria-label="Month before">
            <ChevronLeft />
          </Link>
        </Button>
        <span className="min-w-24 text-center font-medium">{formatMonth(month)}</span>
        {month < thisMonth ? (
          <Button variant="outline" size="icon" asChild>
            <Link href={`${here}?month=${addMonthsToMonth(month, 1)}`} aria-label="Month after">
              <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled aria-label="Month after">
            <ChevronRight />
          </Button>
        )}
      </nav>

      {!slot ? (
        <EmptyRow message="This class time has no hours and days yet, so it takes no attendance. The admin sets them on the skill's page." />
      ) : days.length === 0 ? (
        <EmptyRow message={`No class days in ${formatMonth(month)} up to today.`} />
      ) : rows.length === 0 ? (
        <EmptyRow message={`Nobody was in this class time in ${formatMonth(month)}.`} />
      ) : (
        <>
          {notTaken.length > 0 && isTeacher ? (
            // Only the office takes a past day's sheet, so there's nothing to open.
            <p className="text-sm">
              Not taken on {notTaken.length} of {days.length} days.
            </p>
          ) : notTaken.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm">
                Not taken yet on {notTaken.length} of {days.length} days:
              </p>
              <div className="flex flex-wrap gap-1">
                {notTaken.map((day) => (
                  <Button key={day.date} variant="outline" size="sm" asChild>
                    <Link href={`${here}/${day.date}`}>{formatShortDay(day.date)}</Link>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-40 bg-background">Student</TableHead>
                  {days.map((day) => (
                    <TableHead key={day.date} className="px-1 text-center">
                      <Link
                        href={`${here}/${day.date}`}
                        className="inline-flex flex-col items-center rounded-md px-1.5 py-1 leading-tight hover:bg-muted"
                        title={day.taken ? `Open ${formatShortDay(day.date)}` : `Take ${formatShortDay(day.date)}`}
                      >
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {weekdayOnly.format(new Date(`${day.date}T00:00:00.000Z`))}
                        </span>
                        <span className={cn(!day.taken && "text-muted-foreground")}>
                          {Number(day.date.slice(8))}
                        </span>
                      </Link>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const rate = attendanceRate(row.counts);
                  return (
                    <TableRow key={row.enrollmentId}>
                      <TableCell className="sticky left-0 z-10 bg-background">
                        {isTeacher ? (
                          <StudentName student={row.student} />
                        ) : (
                          <Link href={`/students/${row.student.id}`} className="hover:underline">
                            <StudentName student={row.student} />
                          </Link>
                        )}
                      </TableCell>
                      {days.map((day) => {
                        const mark = row.marks.get(day.date);
                        return (
                          <TableCell key={day.date} className="px-1 text-center">
                            {mark ? (
                              <span
                                className={cn(
                                  "inline-flex size-7 items-center justify-center rounded-md border text-xs font-semibold",
                                  markStyle[mark],
                                )}
                                title={`${markLabel[mark]}, ${formatShortDay(day.date)}`}
                              >
                                {MARKS.find((option) => option.value === mark)?.short}
                              </span>
                            ) : (
                              <span
                                className="text-muted-foreground"
                                title={day.taken ? "Not on this sheet" : "Not taken"}
                              >
                                {day.taken ? "–" : "·"}
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right tabular-nums" title={formatCounts(row.counts)}>
                        {rate === null ? "—" : formatRate(rate)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            {MARKS.map((option) => `${option.short} ${option.label}`).join(" · ")} · “·” not taken ·
            “–” not on that day&apos;s sheet. The rate counts Late as present and leaves Excused out.
          </p>
        </>
      )}
    </>
  );
}

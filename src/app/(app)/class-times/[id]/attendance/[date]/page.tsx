import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { formatSlot } from "@/lib/class-times";
import { addDays, collegeToday, formatDateTime, isIsoDate, monthOf } from "@/lib/dates";
import { formatStudentNumber } from "@/lib/format";
import { requireSignedIn } from "@/lib/session";
import { canMarkOn } from "../../../../attendance/access";
import { saveAttendanceSheet } from "../../../../attendance/actions";
import { classDaysBetween, sheetDayProblem } from "../../../../attendance/days";
import { formatLongDay, formatShortDay } from "../../../../attendance/labels";
import { findClassTime, loadSheet } from "../../../../attendance/queries";
import { SheetForm } from "../../../../attendance/sheet-form";

export async function generateMetadata({
  params,
}: PageProps<"/class-times/[id]/attendance/[date]">): Promise<Metadata> {
  const { date } = await params;
  return { title: isIsoDate(date) ? `Attendance, ${formatShortDay(date)}` : "Attendance" };
}

/**
 * One class time's attendance on one day: the sheet to take, or the one
 * already taken to correct. Staff at its branch and the admin can open any
 * of its days up to today, so a sheet kept on paper can be typed in later.
 * Its teacher marks today's, and reads the others.
 */
export default async function AttendanceSheetPage({
  params,
}: PageProps<"/class-times/[id]/attendance/[date]">) {
  const user = await requireSignedIn();
  const { id, date } = await params;
  if (!isIsoDate(date)) notFound();
  const classTime = await findClassTime(user, id);
  if (!classTime) notFound();

  const today = collegeToday();
  const { sheet, students } = await loadSheet(id, date);
  const problem = sheetDayProblem(classTime, date, today, sheet !== null);
  const readOnly = !canMarkOn(user, date, today);
  const marks = new Map(sheet?.entries.map((entry) => [entry.enrollmentId, entry.mark]));
  const skillName = classTime.branchSkill.skill.name;
  const here = `/class-times/${id}/attendance`;

  // The class days either side, to go through a week of paper sheets in a row.
  const previous = classDaysBetween(classTime, addDays(date, -7), addDays(date, -1)).at(-1);
  const next = classDaysBetween(classTime, addDays(date, 1), addDays(date, 7)).find(
    (day) => day <= today,
  );

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`${here}?month=${monthOf(date)}`}>
          <ChevronLeft />
          Attendance for {skillName}
        </Link>
      </Button>

      <PageHeader
        title={formatLongDay(date)}
        description={`${skillName}, ${formatSlot(classTime)}, in ${classTime.classroom.name} with ${classTime.teacher.name}. ${classTime.branchSkill.branch.name}.`}
      >
        {previous && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`${here}/${previous}`}>
              <ChevronLeft />
              {formatShortDay(previous)}
            </Link>
          </Button>
        )}
        {next && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`${here}/${next}`}>
              {formatShortDay(next)}
              <ChevronRight />
            </Link>
          </Button>
        )}
      </PageHeader>

      <p className="text-sm text-muted-foreground">
        {sheet ? (
          <>
            Taken by {sheet.takenBy.name}, {formatDateTime(sheet.createdAt)}.
            {sheet.changedBy && sheet.changedAt && (
              <> Changed by {sheet.changedBy.name}, {formatDateTime(sheet.changedAt)}.</>
            )}
          </>
        ) : readOnly ? (
          "Not taken."
        ) : (
          "Not taken yet. Everyone starts as Present: mark the students who weren't."
        )}
        {readOnly && " You mark today's attendance only. To change this day's, ask the office."}
      </p>

      {problem ? (
        <EmptyRow message={problem} />
      ) : readOnly && !sheet ? null : students.length === 0 ? (
        <EmptyRow message="Nobody was in this class time that day." />
      ) : (
        <SheetForm
          // A new key per day, so going to the next day starts its sheet afresh.
          key={date}
          action={saveAttendanceSheet.bind(null, id, date)}
          saved={sheet !== null}
          readOnly={readOnly}
          students={students.map((enrollment) => ({
            enrollmentId: enrollment.id,
            studentNumber: formatStudentNumber(enrollment.student.number),
            fullName: enrollment.student.fullName,
            photoUrl: enrollment.student.photoUrl,
            mark: marks.get(enrollment.id) ?? "PRESENT",
          }))}
        />
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, CircleSlash, Clock, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import type { AttendanceMark } from "@/generated/prisma/client";
import { formatHours, slotOf, type ClassTimeHours } from "@/lib/class-times";
import {
  addDays,
  collegeToday,
  formatMonth,
  fromDbDate,
  monthOf,
  toCollegeDate,
  toDbDate,
} from "@/lib/dates";
import { requireStudent } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  attendanceRate,
  countMarks,
  formatCounts,
  formatRate,
  markLabel,
} from "../../../(app)/attendance/labels";
import { classDaysBetween } from "../../../(app)/attendance/days";
import { getPortalAttendance } from "../../queries";

export const metadata: Metadata = { title: "Attendance" };

/** How a day's date tile and icon look, for each mark and for a day with none. */
const look: Record<AttendanceMark | "NONE", { tile: string; icon: React.ReactNode }> = {
  PRESENT: {
    tile: "border-success-border bg-success text-success-foreground",
    icon: <Check className="size-5 text-success-foreground" />,
  },
  ABSENT: {
    tile: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: <X className="size-5 text-destructive" />,
  },
  LATE: {
    tile: "border-warning-border bg-warning text-warning-foreground",
    icon: <Clock className="size-5 text-warning-foreground" />,
  },
  EXCUSED: {
    tile: "border-border bg-secondary text-secondary-foreground",
    icon: <CircleSlash className="size-5 text-muted-foreground" />,
  },
  NONE: {
    tile: "border-dashed border-muted-foreground/40 text-muted-foreground",
    icon: <Minus className="size-5 text-muted-foreground" />,
  },
};

const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });

/** "8:00–9:00 pm · Room 1", or just the room for a class time with no hours. */
function placeOf(classTime: ClassTimeHours & { classroom: { name: string } }) {
  const slot = slotOf(classTime);
  return slot ? `${formatHours(slot)} · ${classTime.classroom.name}` : classTime.classroom.name;
}

type Day = { date: string; mark: AttendanceMark | null; place: string };

function DayRow({ day }: { day: Day }) {
  const { tile, icon } = look[day.mark ?? "NONE"];
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div
        className={cn(
          "flex size-11 shrink-0 flex-col items-center justify-center rounded-lg border leading-tight",
          tile,
        )}
      >
        <span className="text-[10px]">{weekday.format(toDbDate(day.date))}</span>
        <span className="text-base font-semibold">{Number(day.date.slice(8))}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-medium", !day.mark && "text-muted-foreground")}>
          {day.mark ? markLabel[day.mark] : "Not taken"}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {day.mark ? day.place : "Nobody marked you this day"}
        </div>
      </div>
      {icon}
    </li>
  );
}

/**
 * One skill's attendance as a timeline, newest first, by month: every day
 * the student was marked, and every class day since attendance began there
 * that nobody marked them, so a gap doesn't look like a day they came.
 */
export default async function PortalSkillAttendancePage({
  params,
}: PageProps<"/portal/attendance/[id]">) {
  const user = await requireStudent();
  const { id } = await params;
  // Another student's skill, or a made-up one: either way, not theirs.
  const enrollment = await getPortalAttendance(user.studentId, id);
  if (!enrollment) notFound();

  const marked: Day[] = enrollment.attendance.map((entry) => ({
    date: fromDbDate(entry.sheet.date),
    mark: entry.mark,
    place: placeOf(entry.sheet.classTime),
  }));
  const counts = countMarks(enrollment.attendance.map((entry) => entry.mark));
  const rate = attendanceRate(counts);

  // Class days with no mark, from when attendance began in their class time
  // (or their first mark, if earlier) up to today, or the day before they
  // finished or dropped. Before any sheet was taken there, nothing is missing.
  const { classTime } = enrollment;
  const firstSheet = classTime.attendanceSheets[0]?.date;
  const starts = [
    ...(firstSheet ? [fromDbDate(firstSheet)] : []),
    ...(marked.length > 0 ? [marked[marked.length - 1].date] : []),
  ].toSorted();
  const joined = fromDbDate(enrollment.startDate);
  const from = starts[0] && starts[0] > joined ? starts[0] : joined;
  const stopped =
    enrollment.status !== "ACTIVE" && enrollment.statusChangedAt
      ? addDays(toCollegeDate(enrollment.statusChangedAt), -1)
      : null;
  const today = collegeToday();
  const to = stopped && stopped < today ? stopped : today;
  const markedDates = new Set(marked.map((day) => day.date));
  const unmarked: Day[] =
    starts.length === 0
      ? []
      : classDaysBetween(classTime, from, to)
          .filter((date) => !markedDates.has(date))
          .map((date) => ({ date, mark: null, place: placeOf(classTime) }));

  const days = [...marked, ...unmarked].toSorted((a, b) => b.date.localeCompare(a.date));
  const months = Map.groupBy(days, (day) => monthOf(day.date));

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/portal/attendance">
          <ChevronLeft />
          Attendance
        </Link>
      </Button>

      <PageHeader
        title={enrollment.skill.name}
        description={`Attendance at ${enrollment.branchSkill.branch.name}`}
      />

      {days.length === 0 ? (
        <EmptyRow message="No attendance has been taken for you in this skill yet." />
      ) : (
        <div className="max-w-2xl space-y-6">
          {marked.length > 0 && (
            <Card>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums">
                  {rate === null ? "—" : formatRate(rate)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatCounts(counts)}. Late counts as present; Excused counts neither way.
                </p>
              </CardContent>
            </Card>
          )}

          {[...months].map(([month, monthDays]) => (
            <section key={month} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">{formatMonth(month)}</h2>
              <ul className="divide-y rounded-lg border bg-card">
                {monthDays.map((day) => (
                  <DayRow key={day.date} day={day} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

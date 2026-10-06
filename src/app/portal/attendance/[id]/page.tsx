import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { formatMonth, fromDbDate, monthOf } from "@/lib/dates";
import { requireStudent } from "@/lib/session";
import {
  attendanceRate,
  countMarks,
  formatCounts,
  formatLongDay,
  formatRate,
  markLabel,
  markStyle,
} from "../../../(app)/attendance/labels";
import { getPortalAttendance } from "../../queries";

export const metadata: Metadata = { title: "Attendance" };

/** Every day the student was marked in one of their skills, by month, newest first. */
export default async function PortalAttendancePage({ params }: PageProps<"/portal/attendance/[id]">) {
  const user = await requireStudent();
  const { id } = await params;
  // Another student's skill, or a made-up one: either way, not theirs.
  const enrollment = await getPortalAttendance(user.studentId, id);
  if (!enrollment) notFound();

  const days = enrollment.attendance.map((entry) => ({
    date: fromDbDate(entry.sheet.date),
    mark: entry.mark,
  }));
  const counts = countMarks(days.map((day) => day.mark));
  const rate = attendanceRate(counts);
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

          {[...months].map(([month, monthDays]) => (
            <section key={month} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">{formatMonth(month)}</h2>
              <ul className="divide-y rounded-lg border bg-background">
                {monthDays.map((day) => (
                  <li key={day.date} className="flex items-center justify-between gap-2 px-4 py-3">
                    <span className="text-sm">{formatLongDay(day.date)}</span>
                    <Badge variant="outline" className={cn("min-w-18 justify-center", markStyle[day.mark])}>
                      {markLabel[day.mark]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

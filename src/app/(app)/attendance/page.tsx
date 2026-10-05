import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { formatHours, slotOf } from "@/lib/class-times";
import { collegeToday, isIsoDate } from "@/lib/dates";
import { one } from "@/lib/search-params";
import { requireUser } from "@/lib/session";
import { countMarks, formatCounts, formatLongDay } from "./labels";
import { classTimesOn } from "./queries";

export const metadata: Metadata = { title: "Attendance" };

const warning = "border-warning-border bg-warning text-warning-foreground";

/**
 * Every class time meeting on a day, today unless another is picked, and
 * whether its attendance has been taken. Branch staff see their own branch's;
 * the admin sees every branch's.
 */
export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const today = collegeToday();
  const asked = one(await searchParams, "day");
  const day = isIsoDate(asked) ? asked : today;
  const { classTimes, untimed } = day <= today ? await classTimesOn(user, day) : { classTimes: [], untimed: 0 };
  const taken = classTimes.filter((classTime) => classTime.attendanceSheets.length > 0).length;

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`${isAdmin ? "Every branch's" : "Your branch's"} class times ${day === today ? "today" : "on the day picked"}, and whether their attendance has been taken.`}
      />

      <Form action="/attendance" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="day">Day</Label>
          <Input id="day" name="day" type="date" defaultValue={day} max={today} className="w-44" />
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
        {day !== today && (
          <Button variant="ghost" asChild>
            <Link href="/attendance">Today</Link>
          </Button>
        )}
      </Form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{formatLongDay(day)}</h2>
          {classTimes.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Taken for {taken} of {classTimes.length}
            </p>
          )}
        </div>

        {day > today ? (
          <EmptyRow message="That day hasn't come yet." />
        ) : classTimes.length === 0 ? (
          <EmptyRow message="No class time with students in it meets on this day." />
        ) : (
          <DataTable
            columns={[
              { label: "Time" },
              { label: "Skill" },
              { label: "Class" },
              { label: "Teacher" },
              ...(isAdmin ? [{ label: "Branch" }] : []),
              { label: "Students", className: "text-right tabular-nums" },
              { label: "Attendance" },
              { label: "Actions", actions: true, className: "text-right" },
            ]}
            rows={classTimes.map((classTime) => {
              const slot = slotOf(classTime);
              const sheet = classTime.attendanceSheets[0];
              const skillName = classTime.branchSkill.skill.name;
              const href = `/class-times/${classTime.id}/attendance/${day}`;
              return {
                key: classTime.id,
                title: skillName,
                description: slot ? formatHours(slot) : undefined,
                cells: {
                  Time: slot ? formatHours(slot) : "Time not set",
                  Skill: (
                    <Link href={`/class-times/${classTime.id}`} className="font-medium hover:underline">
                      {skillName}
                    </Link>
                  ),
                  Class: classTime.classroom.name,
                  Teacher: classTime.teacher.name,
                  Branch: classTime.branchSkill.branch.name,
                  Students: sheet ? sheet.entries.length : classTime._count.enrollments,
                  Attendance: sheet ? (
                    <div>
                      <Badge variant="secondary">Taken</Badge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatCounts(countMarks(sheet.entries.map((entry) => entry.mark)))}. By{" "}
                        {sheet.changedBy ? `${sheet.takenBy.name}, changed by ${sheet.changedBy.name}` : sheet.takenBy.name}
                      </div>
                    </div>
                  ) : (
                    <Badge variant="outline" className={warning}>
                      Not taken
                    </Badge>
                  ),
                  Actions: (
                    <Button size="sm" variant={sheet ? "outline" : "default"} asChild>
                      <Link href={href}>{sheet ? "Open" : "Take attendance"}</Link>
                    </Button>
                  ),
                },
              };
            })}
          />
        )}

        {untimed > 0 && day <= today && (
          <p className="text-sm text-muted-foreground">
            {untimed === 1 ? "1 class time with students has" : `${untimed} class times with students have`} no
            hours and days yet, so {untimed === 1 ? "it takes" : "they take"} no attendance.
            {isAdmin ? " Set them on each skill's page." : " The admin sets them."}
          </p>
        )}
      </section>
    </>
  );
}

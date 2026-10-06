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
import { formatHours, formatSlot, slotOf } from "@/lib/class-times";
import { collegeToday, isIsoDate } from "@/lib/dates";
import { one } from "@/lib/search-params";
import { requireSignedIn } from "@/lib/session";
import { canMarkOn } from "./access";
import { countMarks, formatCounts, formatLongDay } from "./labels";
import { classTimesOn, classTimesTaughtBy } from "./queries";

export const metadata: Metadata = { title: "Attendance" };

const warning = "border-warning-border bg-warning text-warning-foreground";

/**
 * Every class time meeting on a day, today unless another is picked, and
 * whether its attendance has been taken. Branch staff see their own branch's;
 * the admin sees every branch's. A teacher sees the class times they teach,
 * and under them their week.
 */
export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const user = await requireSignedIn();
  const isAdmin = user.role === "admin";
  const isTeacher = user.role === "teacher";
  const today = collegeToday();
  const asked = one(await searchParams, "day");
  const day = isIsoDate(asked) ? asked : today;
  const [{ classTimes, untimed }, taught] = await Promise.all([
    day <= today ? classTimesOn(user, day) : { classTimes: [], untimed: 0 },
    isTeacher ? classTimesTaughtBy(user.teacherId) : [],
  ]);
  const taken = classTimes.filter((classTime) => classTime.attendanceSheets.length > 0).length;
  // A teacher working at one branch doesn't need it named on every row.
  const showBranch =
    isAdmin ||
    (isTeacher && new Set(taught.map((classTime) => classTime.branchSkill.branch.name)).size > 1);
  const whose = isAdmin ? "Every branch's" : isTeacher ? "Your" : "Your branch's";

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`${whose} class times ${day === today ? "today" : "on the day picked"}, and whether their attendance has been taken.`}
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

        {isTeacher && day < today && (
          <p className="text-sm text-muted-foreground">
            You mark today&apos;s attendance only. To change another day&apos;s, ask the office.
          </p>
        )}

        {day > today ? (
          <EmptyRow message="That day hasn't come yet." />
        ) : classTimes.length === 0 ? (
          <EmptyRow
            message={
              isTeacher
                ? "None of your class times with students in it meets on this day."
                : "No class time with students in it meets on this day."
            }
          />
        ) : (
          <DataTable
            columns={[
              { label: "Time" },
              { label: "Skill" },
              { label: "Class" },
              ...(isTeacher ? [] : [{ label: "Teacher" }]),
              ...(showBranch ? [{ label: "Branch" }] : []),
              { label: "Students", className: "text-right tabular-nums" },
              { label: "Attendance" },
              { label: "Actions", actions: true, className: "text-right" },
            ]}
            rows={classTimes.map((classTime) => {
              const slot = slotOf(classTime);
              const sheet = classTime.attendanceSheets[0];
              const skillName = classTime.branchSkill.skill.name;
              const href = `/class-times/${classTime.id}/attendance/${day}`;
              const canMark = canMarkOn(user, day, today);
              return {
                key: classTime.id,
                title: skillName,
                description: slot ? formatHours(slot) : undefined,
                cells: {
                  Time: slot ? formatHours(slot) : "Time not set",
                  Skill: (
                    // A teacher has no class time page, only its attendance.
                    <Link
                      href={isTeacher ? `/class-times/${classTime.id}/attendance` : `/class-times/${classTime.id}`}
                      className="font-medium hover:underline"
                    >
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
                  Actions:
                    sheet || canMark ? (
                      <Button size="sm" variant={sheet ? "outline" : "default"} asChild>
                        <Link href={href}>{sheet ? "Open" : "Take attendance"}</Link>
                      </Button>
                    ) : null,
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

      {isTeacher && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Your class times</h2>
            <p className="text-sm text-muted-foreground">
              Everything you teach. Open one to see its attendance month by month.
            </p>
          </div>

          {taught.length === 0 ? (
            <EmptyRow message="You don't teach any class times yet. The admin sets them on each skill's page." />
          ) : (
            <DataTable
              columns={[
                { label: "Skill" },
                { label: "When" },
                { label: "Class" },
                ...(showBranch ? [{ label: "Branch" }] : []),
                { label: "Students", className: "text-right tabular-nums" },
                { label: "Actions", actions: true, className: "text-right" },
              ]}
              rows={taught.map((classTime) => ({
                key: classTime.id,
                title: classTime.branchSkill.skill.name,
                description: formatSlot(classTime),
                cells: {
                  Skill: <span className="font-medium">{classTime.branchSkill.skill.name}</span>,
                  When: formatSlot(classTime),
                  Class: classTime.classroom.name,
                  Branch: classTime.branchSkill.branch.name,
                  Students: classTime._count.enrollments,
                  Actions: (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/class-times/${classTime.id}/attendance`}>Attendance</Link>
                    </Button>
                  ),
                },
              }))}
            />
          )}
        </section>
      )}
    </>
  );
}

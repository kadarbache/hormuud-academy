import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { formatHours, slotOf, WEEKDAYS, type Slot } from "@/lib/class-times";
import { inUse } from "@/lib/clashes";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/classes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const classroom = await prisma.classroom.findUnique({ where: { id }, select: { name: true } });
  return { title: classroom ? `${classroom.name} timetable` : "Class" };
}

const studentCount = (count: number) => `${count} ${count === 1 ? "student" : "students"}`;

/** One class time as the timetable shows it. */
type Entry = {
  id: string;
  skillId: string;
  skillName: string;
  teacherName: string;
  students: number;
  active: boolean;
};

/**
 * A class's week: for each day, what meets there in clock order, with the
 * free hours between. Only class times that hold the class show: active
 * ones, and deactivated ones that still have students coming.
 */
export default async function ClassTimetablePage({ params }: PageProps<"/classes/[id]">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const { id } = await params;
  const classroom = await prisma.classroom.findUnique({
    where: { id },
    include: {
      branch: { select: { name: true } },
      classTimes: {
        where: inUse,
        orderBy: { startMinute: "asc" },
        include: {
          branchSkill: { select: { skillId: true, skill: { select: { name: true } } } },
          teacher: { select: { name: true } },
          _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });
  // Branch staff see their own branch's classes only.
  if (!classroom || (!isAdmin && classroom.branchId !== user.branchId)) notFound();

  const entries = classroom.classTimes.map((classTime) => ({
    slot: slotOf(classTime),
    entry: {
      id: classTime.id,
      skillId: classTime.branchSkill.skillId,
      skillName: classTime.branchSkill.skill.name,
      teacherName: classTime.teacher.name,
      students: classTime._count.enrollments,
      active: classTime.active,
    } satisfies Entry,
  }));
  const timed = entries.flatMap(({ slot, entry }) => (slot ? [{ slot, entry }] : []));
  const untimed = entries.filter(({ slot }) => !slot).map(({ entry }) => entry);
  const week = WEEKDAYS.map((day) => ({
    ...day,
    meetings: timed.filter(({ slot }) => slot.days.includes(day.value)),
  }));

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/classes">
          <ChevronLeft />
          Classes
        </Link>
      </Button>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {classroom.name}
            {!classroom.active && (
              <Badge variant="outline" className="text-muted-foreground">
                Inactive
              </Badge>
            )}
          </span>
        }
        description={`${classroom.branch.name}. What meets in this class each day of the week. ${
          isAdmin
            ? "Class times are added and changed on each skill's page."
            : "Only the admin can change them."
        }`}
      />

      {entries.length === 0 ? (
        <EmptyRow message="Nothing meets in this class yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {week.map((day) => (
            <section key={day.value} className="min-w-0 rounded-lg border p-3">
              <h2 className="mb-2 text-sm font-semibold">{day.long}</h2>
              {day.meetings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Free all day</p>
              ) : (
                <ol className="space-y-2">
                  {day.meetings.map(({ slot, entry }, index) => {
                    const before = day.meetings[index - 1]?.slot;
                    return (
                      <li key={entry.id} className="space-y-2">
                        {before && before.endMinute < slot.startMinute && (
                          <FreeHours from={before} to={slot} />
                        )}
                        <Meeting slot={slot} entry={entry} linkSkill={isAdmin} />
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}

      {untimed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Time not set</h2>
          <p className="text-sm text-muted-foreground">
            These use this class but have no hours or days yet, so they aren&apos;t on the week
            above.{" "}
            {isAdmin
              ? "Set them on the skill's page."
              : "The admin sets them on the skill's page."}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {untimed.map((entry) => (
              <li key={entry.id}>
                <Meeting entry={entry} linkSkill={isAdmin} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** One class time on one day: its hours, skill, teacher and how many come. */
function Meeting({ slot, entry, linkSkill }: { slot?: Slot; entry: Entry; linkSkill: boolean }) {
  return (
    <div className="rounded-md border bg-card p-2 text-sm">
      {slot && <div className="font-medium tabular-nums">{formatHours(slot)}</div>}
      <div className={slot ? undefined : "font-medium"}>
        {linkSkill ? (
          <Link href={`/admin/skills/${entry.skillId}`} className="hover:underline">
            {entry.skillName}
          </Link>
        ) : (
          entry.skillName
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {entry.teacherName} ·{" "}
        <Link
          href={`/class-times/${entry.id}`}
          className="font-medium text-foreground underline underline-offset-2"
        >
          {studentCount(entry.students)}
        </Link>
      </div>
      {/* Deactivated, it takes nobody new, but its students still come. */}
      {!entry.active && (
        <Badge variant="outline" className="mt-1 text-muted-foreground">
          Deactivated
        </Badge>
      )}
    </div>
  );
}

/** The gap between two class times on one day, when the class stands empty. */
function FreeHours({ from, to }: { from: Slot; to: Slot }) {
  return (
    <div className="rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
      Free {formatHours({ startMinute: from.endMinute, endMinute: to.startMinute })}
    </div>
  );
}

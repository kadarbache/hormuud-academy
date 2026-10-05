import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDays, formatHours, slotOf, toClockInput } from "@/lib/class-times";
import { formatMoney, formatMonths } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { SkillDialog } from "../skill-dialog";
import { BranchSkillDialog } from "../branch-skill-dialog";
import { ClassTimeDialog, type BranchChoices } from "../class-time-dialog";
import {
  addBranchSkill,
  deleteBranchSkill,
  deleteSkill,
  setBranchSkillActive,
  setSkillActive,
  updateBranchSkill,
  updateSkill,
} from "../actions";
import {
  addClassTime,
  deleteClassTime,
  setClassTimeActive,
  updateClassTime,
} from "../class-time-actions";

export async function generateMetadata({ params }: PageProps<"/admin/skills/[id]">): Promise<Metadata> {
  const { id } = await params;
  const skill = await prisma.skill.findUnique({ where: { id }, select: { name: true } });
  return { title: skill?.name ?? "Skill" };
}

export default async function SkillPage({ params }: PageProps<"/admin/skills/[id]">) {
  const { id } = await params;
  const skill = await prisma.skill.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      branchSkills: {
        orderBy: { branch: { name: "asc" } },
        include: {
          branch: { select: { name: true } },
          classTimes: {
            include: {
              classroom: { select: { name: true } },
              teacher: { select: { name: true } },
            },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!skill) notFound();

  const branchIds = skill.branchSkills.map((bs) => bs.branchId);
  const [categories, branches, teachers, classrooms, enrollmentCounts] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.teacher.findMany({
      where: { active: true, branches: { some: { branchId: { in: branchIds } } } },
      orderBy: { name: "asc" },
      include: { branches: { select: { branchId: true } } },
    }),
    prisma.classroom.findMany({
      where: { active: true, branchId: { in: branchIds } },
      orderBy: { name: "asc" },
    }),
    prisma.enrollment.groupBy({
      by: ["classTimeId", "status"],
      where: { skillId: skill.id },
      _count: { _all: true },
    }),
  ]);

  // How many students are in these class times now, and how many ever were.
  // Only a class time nobody was ever in can be removed outright, and the
  // same goes for a branch.
  const countsFor = (classTimeIds: string[]) => {
    const rows = enrollmentCounts.filter((row) => classTimeIds.includes(row.classTimeId));
    return {
      active: rows.reduce((sum, row) => sum + (row.status === "ACTIVE" ? row._count._all : 0), 0),
      total: rows.reduce((sum, row) => sum + row._count._all, 0),
    };
  };

  const takenBranchIds = new Set(branchIds);
  const openBranches = branches
    .filter((branch) => !takenBranchIds.has(branch.id))
    .map((branch) => ({ value: branch.id, label: branch.name }));
  const choicesFor = (branchId: string): BranchChoices => ({
    classrooms: classrooms
      .filter((classroom) => classroom.branchId === branchId)
      .map((classroom) => ({ value: classroom.id, label: classroom.name })),
    teachers: teachers
      .filter((teacher) => teacher.branches.some((link) => link.branchId === branchId))
      .map((teacher) => ({ value: teacher.id, label: teacher.name })),
  });
  // The skill's own category stays pickable even if it was deactivated since.
  const categoryOptions = categories.some((category) => category.id === skill.categoryId)
    ? categories.map((category) => ({ value: category.id, label: category.name }))
    : [
        { value: skill.categoryId, label: skill.category.name },
        ...categories.map((category) => ({ value: category.id, label: category.name })),
      ];
  const canDelete = skill.branchSkills.length === 0 && skill._count.enrollments === 0;
  const registration = skill.registrationFee.gt(0)
    ? `${formatMoney(skill.registrationFee.toString())} to register`
    : "no registration fee";
  const defaults = {
    durationMonths: skill.durationMonths,
    registrationFee: skill.registrationFee.toString(),
    monthlyFee: skill.monthlyFee.toString(),
  };

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/skills">
          <ChevronLeft />
          Skills
        </Link>
      </Button>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {skill.name}
            <ActiveBadge active={skill.active} />
          </span>
        }
        description={`${skill.category.name} · Defaults for a new branch: ${formatMonths(skill.durationMonths)}, ${registration}, ${formatMoney(skill.monthlyFee.toString())} a month`}
      >
        <SkillDialog
          action={updateSkill.bind(null, skill.id)}
          categories={categoryOptions}
          skill={{
            name: skill.name,
            categoryId: skill.categoryId,
            ...defaults,
          }}
          trigger={<Button variant="outline">Edit skill</Button>}
        />
        <ActionButton variant="outline" action={setSkillActive.bind(null, skill.id, !skill.active)}>
          {skill.active ? "Deactivate" : "Activate"}
        </ActionButton>
        {canDelete && (
          <ActionButton
            variant="destructive"
            action={deleteSkill.bind(null, skill.id)}
            confirm={{
              title: `Delete ${skill.name}?`,
              description: "No branch teaches this skill yet, so it can be deleted for good.",
              confirmLabel: "Delete skill",
              destructive: true,
            }}
          >
            Delete
          </ActionButton>
        )}
      </PageHeader>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Branches that teach it</h2>
            <p className="text-sm text-muted-foreground">
              Each branch sets its own fees and duration. Its class times say when, where and with
              whom.
            </p>
          </div>
          <BranchSkillDialog
            action={addBranchSkill.bind(null, skill.id)}
            branches={openBranches}
            pricing={defaults}
            trigger={
              <Button disabled={openBranches.length === 0}>
                <Plus />
                Add to a branch
              </Button>
            }
          />
        </div>

        {skill.branchSkills.length === 0 && (
          <EmptyRow message="No branch teaches this skill yet, so nobody can enroll in it." />
        )}

        <Accordion
          type="multiple"
          // Every branch starts closed: open one to see its class times.
          defaultValue={[]}
          className="space-y-3"
        >
          {skill.branchSkills.map((bs) => {
            const counts = countsFor(bs.classTimes.map((classTime) => classTime.id));
            const choices = choicesFor(bs.branchId);
            // By the clock, with the ones still waiting for a time first.
            const classTimes = bs.classTimes.toSorted(
              (a, b) =>
                (a.startMinute ?? -1) - (b.startMinute ?? -1) ||
                a.classroom.name.localeCompare(b.classroom.name),
            );
            const registration = bs.registrationFee.gt(0)
              ? `${formatMoney(bs.registrationFee.toString())} to register`
              : "no registration fee";
            return (
              <AccordionItem key={bs.id} value={bs.id}>
                <AccordionTrigger>
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 font-semibold">
                      {bs.branch.name}
                      <ActiveBadge active={bs.active} />
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatMonths(bs.durationMonths)}, {registration},{" "}
                      {formatMoney(bs.monthlyFee.toString())} a month ·{" "}
                      {counts.active === 1 ? "1 active student" : `${counts.active} active students`}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-3">
                    <div className="flex flex-wrap gap-1">
                      <ClassTimeDialog
                        action={addClassTime.bind(null, bs.id)}
                        branchName={bs.branch.name}
                        choices={choices}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Plus />
                            Add class time
                          </Button>
                        }
                      />
                      <BranchSkillDialog
                        action={updateBranchSkill.bind(null, bs.id)}
                        branches={[]}
                        branchName={bs.branch.name}
                        pricing={{
                          durationMonths: bs.durationMonths,
                          registrationFee: bs.registrationFee.toString(),
                          monthlyFee: bs.monthlyFee.toString(),
                        }}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Change fees
                          </Button>
                        }
                      />
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        action={setBranchSkillActive.bind(null, bs.id, !bs.active)}
                      >
                        {bs.active ? "Deactivate" : "Activate"}
                      </ActionButton>
                      {counts.total === 0 && (
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          action={deleteBranchSkill.bind(null, bs.id)}
                          confirm={{
                            title: `Remove ${skill.name} from ${bs.branch.name}?`,
                            description:
                              "No student has taken it at this branch, so it can be removed for good, with its class times.",
                            confirmLabel: "Remove",
                            destructive: true,
                          }}
                        >
                          Remove
                        </ActionButton>
                      )}
                    </div>

                    {classTimes.length === 0 ? (
                      <EmptyRow message="No class times yet, so nobody can join it here. Add one to say when, where and with whom." />
                    ) : (
                      <DataTable
                        columns={[
                          { label: "Time", className: "font-medium tabular-nums" },
                          { label: "Days" },
                          { label: "Class" },
                          { label: "Teacher" },
                          { label: "Students", className: "text-right tabular-nums" },
                          { label: "Status" },
                          { label: "Actions", actions: true, className: "text-right" },
                        ]}
                        rows={classTimes.map((classTime) => {
                          const students = countsFor([classTime.id]);
                          const slot = slotOf(classTime);
                          const hours = slot ? formatHours(slot) : null;
                          return {
                            key: classTime.id,
                            title: hours ?? "Time not set",
                            description: `${classTime.classroom.name} with ${classTime.teacher.name}`,
                            cells: {
                              Time: hours ? (
                                <Link href={`/class-times/${classTime.id}`} className="hover:underline">
                                  {hours}
                                </Link>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-warning-border bg-warning text-warning-foreground"
                                >
                                  Time not set
                                </Badge>
                              ),
                              Days: classTime.days.length > 0 ? formatDays(classTime.days) : "None",
                              Class: classTime.classroom.name,
                              Teacher: classTime.teacher.name,
                              Students: students.active,
                              Status: <ActiveBadge active={classTime.active} />,
                              Actions: (
                                <div className="flex justify-end gap-1">
                                  <Button variant="outline" size="sm" asChild>
                                    <Link href={`/class-times/${classTime.id}`}>Students</Link>
                                  </Button>
                                  <ClassTimeDialog
                                    action={updateClassTime.bind(null, classTime.id)}
                                    branchName={bs.branch.name}
                                    choices={choices}
                                    current={{
                                      classroomId: classTime.classroomId,
                                      teacherId: classTime.teacherId,
                                      start: slot ? toClockInput(slot.startMinute) : "",
                                      end: slot ? toClockInput(slot.endMinute) : "",
                                      days: classTime.days,
                                    }}
                                    trigger={
                                      <Button variant="ghost" size="sm">
                                        {slot ? "Change" : "Set time"}
                                      </Button>
                                    }
                                  />
                                  <ActionButton
                                    variant="ghost"
                                    size="sm"
                                    action={setClassTimeActive.bind(null, classTime.id, !classTime.active)}
                                  >
                                    {classTime.active ? "Deactivate" : "Activate"}
                                  </ActionButton>
                                  {students.total === 0 && (
                                    <ActionButton
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      action={deleteClassTime.bind(null, classTime.id)}
                                      confirm={{
                                        title: "Remove this class time?",
                                        description:
                                          "No student has been in it, so it can be removed for good.",
                                        confirmLabel: "Remove",
                                        destructive: true,
                                      }}
                                    >
                                      Remove
                                    </ActionButton>
                                  )}
                                </div>
                              ),
                            },
                          };
                        })}
                      />
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>
    </>
  );
}

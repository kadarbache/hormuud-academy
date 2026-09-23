import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
import { formatMoney, formatMonths } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { SkillDialog } from "../skill-dialog";
import { BranchSkillDialog } from "../branch-skill-dialog";
import {
  addBranchSkill,
  deleteBranchSkill,
  deleteSkill,
  setBranchSkillActive,
  setSkillActive,
  updateBranchSkill,
  updateSkill,
} from "../actions";

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
          teacher: { select: { name: true } },
          classroom: { select: { name: true } },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!skill) notFound();

  const [categories, branches, teachers, classrooms, enrollmentCounts] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.teacher.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { branches: { select: { branchId: true } } },
    }),
    prisma.classroom.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.enrollment.groupBy({
      by: ["branchSkillId", "status"],
      where: { skillId: skill.id },
      _count: { _all: true },
    }),
  ]);

  // Per branch: how many students take the skill now, and how many ever did.
  // Only a branch nobody ever enrolled at can be removed outright.
  const countsFor = (branchSkillId: string) => {
    const rows = enrollmentCounts.filter((row) => row.branchSkillId === branchSkillId);
    return {
      active: rows.find((row) => row.status === "ACTIVE")?._count._all ?? 0,
      total: rows.reduce((sum, row) => sum + row._count._all, 0),
    };
  };

  const takenBranchIds = new Set(skill.branchSkills.map((bs) => bs.branchId));
  const openBranches = branches
    .filter((branch) => !takenBranchIds.has(branch.id))
    .map((branch) => ({ value: branch.id, label: branch.name }));
  const teacherOptions = teachers.map((teacher) => ({
    id: teacher.id,
    name: teacher.name,
    branchIds: teacher.branches.map((link) => link.branchId),
  }));
  const classroomOptions = classrooms.map((classroom) => ({
    id: classroom.id,
    name: classroom.name,
    branchId: classroom.branchId,
  }));
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
              Each branch has its own teacher, class, fees and duration for this skill.
            </p>
          </div>
          <BranchSkillDialog
            action={addBranchSkill.bind(null, skill.id)}
            branches={openBranches}
            teachers={teacherOptions}
            classrooms={classroomOptions}
            pricing={defaults}
            trigger={
              <Button disabled={openBranches.length === 0}>
                <Plus />
                Add to a branch
              </Button>
            }
          />
        </div>

        {skill.branchSkills.length === 0 ? (
          <EmptyRow message="No branch teaches this skill yet, so nobody can enroll in it." />
        ) : (
          <DataTable
            columns={[
              { label: "Branch", className: "font-medium" },
              { label: "Teacher" },
              { label: "Class" },
              { label: "Duration" },
              { label: "Registration fee", className: "text-right tabular-nums" },
              { label: "Monthly fee", className: "text-right tabular-nums" },
              { label: "Active students", className: "text-right tabular-nums" },
              { label: "Status" },
              { label: "Actions", actions: true, className: "text-right" },
            ]}
            rows={skill.branchSkills.map((bs) => {
              const counts = countsFor(bs.id);
              return {
                key: bs.id,
                title: bs.branch.name,
                description: `${skill.name} with ${bs.teacher.name}`,
                cells: {
                  Branch: bs.branch.name,
                  Teacher: bs.teacher.name,
                  Class: bs.classroom.name,
                  Duration: formatMonths(bs.durationMonths),
                  "Registration fee": formatMoney(bs.registrationFee.toString()),
                  "Monthly fee": formatMoney(bs.monthlyFee.toString()),
                  "Active students": counts.active,
                  Status: <ActiveBadge active={bs.active} />,
                  Actions: (
                    <div className="flex justify-end gap-1">
                      <BranchSkillDialog
                        action={updateBranchSkill.bind(null, bs.id)}
                        branches={[]}
                        teachers={teacherOptions}
                        classrooms={classroomOptions}
                        current={{
                          branchId: bs.branchId,
                          branchName: bs.branch.name,
                          teacherId: bs.teacherId,
                          classroomId: bs.classroomId,
                        }}
                        pricing={{
                          durationMonths: bs.durationMonths,
                          registrationFee: bs.registrationFee.toString(),
                          monthlyFee: bs.monthlyFee.toString(),
                        }}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Change
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
                            description: "No student has taken it at this branch, so it can be removed for good.",
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
      </section>
    </>
  );
}

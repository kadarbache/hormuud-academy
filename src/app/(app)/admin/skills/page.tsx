import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
import { formatMoney, formatMonths } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { SkillDialog } from "./skill-dialog";
import { createSkill } from "./actions";

export const metadata: Metadata = { title: "Skills" };

/** "$5.00" when every branch agrees, "$5.00 to $10.00" when they differ. */
function moneyRange(values: number[]) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? formatMoney(low) : `${formatMoney(low)} to ${formatMoney(high)}`;
}

/** "4 months" when every branch agrees, "3 to 4 months" when they differ. */
function monthsRange(values: number[]) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? formatMonths(low) : `${low} to ${high} months`;
}

export default async function SkillsPage() {
  const [skills, categories, activeCounts] = await Promise.all([
    prisma.skill.findMany({
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      include: {
        category: { select: { name: true } },
        branchSkills: {
          where: { active: true },
          select: {
            durationMonths: true,
            registrationFee: true,
            monthlyFee: true,
            branch: { select: { name: true } },
          },
          orderBy: { branch: { name: "asc" } },
        },
      },
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.enrollment.groupBy({
      by: ["skillId"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
  ]);

  const activeBySkill = new Map(activeCounts.map((row) => [row.skillId, row._count._all]));
  const categoryOptions = categories.map((category) => ({ value: category.id, label: category.name }));

  return (
    <>
      <PageHeader
        title="Skills"
        description="The skill catalog for the whole college. Open a skill to set its teacher, class and fees at each branch."
      >
        <SkillDialog
          action={createSkill}
          categories={categoryOptions}
          trigger={
            <Button disabled={categoryOptions.length === 0}>
              <Plus />
              Add skill
            </Button>
          }
        />
      </PageHeader>

      {skills.length === 0 ? (
        <EmptyRow
          message={
            categoryOptions.length === 0
              ? "Add a category first, like Technology Skills, then its skills."
              : "No skills yet."
          }
        />
      ) : (
        <DataTable
          columns={[
            { label: "Skill" },
            { label: "Category" },
            { label: "Duration" },
            { label: "Registration fee", className: "text-right tabular-nums" },
            { label: "Monthly fee", className: "text-right tabular-nums" },
            { label: "Taught at", className: "max-w-56 whitespace-normal" },
            { label: "Active students", className: "text-right tabular-nums" },
            { label: "Status" },
          ]}
          rows={skills.map((skill) => {
            // What the branches teaching it charge, or the skill's defaults
            // while no branch does.
            const rows = skill.branchSkills.length > 0 ? skill.branchSkills : [skill];
            return {
              key: skill.id,
              title: skill.name,
              description: skill.category.name,
              cells: {
                Skill: (
                  <Link href={`/admin/skills/${skill.id}`} className="font-medium hover:underline">
                    {skill.name}
                  </Link>
                ),
                Category: skill.category.name,
                Duration: monthsRange(rows.map((row) => row.durationMonths)),
                "Registration fee": moneyRange(rows.map((row) => Number(row.registrationFee))),
                "Monthly fee": moneyRange(rows.map((row) => Number(row.monthlyFee))),
                "Taught at":
                  skill.branchSkills.length > 0 ? (
                    skill.branchSkills.map((bs) => bs.branch.name).join(", ")
                  ) : (
                    <Link href={`/admin/skills/${skill.id}`} className="text-muted-foreground underline">
                      No branch yet
                    </Link>
                  ),
                "Active students": activeBySkill.get(skill.id) ?? 0,
                Status: <ActiveBadge active={skill.active} />,
              },
            };
          })}
        />
      )}
    </>
  );
}

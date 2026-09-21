import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
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
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skill</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Registration fee</TableHead>
                <TableHead className="text-right">Monthly fee</TableHead>
                <TableHead>Taught at</TableHead>
                <TableHead className="text-right">Active students</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skills.map((skill) => {
                // What the branches teaching it charge, or the skill's defaults
                // while no branch does.
                const rows = skill.branchSkills.length > 0 ? skill.branchSkills : [skill];
                return (
                  <TableRow key={skill.id}>
                    <TableCell>
                      <Link href={`/admin/skills/${skill.id}`} className="font-medium hover:underline">
                        {skill.name}
                      </Link>
                    </TableCell>
                    <TableCell>{skill.category.name}</TableCell>
                    <TableCell>{monthsRange(rows.map((row) => row.durationMonths))}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {moneyRange(rows.map((row) => Number(row.registrationFee)))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {moneyRange(rows.map((row) => Number(row.monthlyFee)))}
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-normal">
                      {skill.branchSkills.length > 0 ? (
                        skill.branchSkills.map((bs) => bs.branch.name).join(", ")
                      ) : (
                        <Link href={`/admin/skills/${skill.id}`} className="text-muted-foreground underline">
                          No branch yet
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{activeBySkill.get(skill.id) ?? 0}</TableCell>
                    <TableCell>
                      <ActiveBadge active={skill.active} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

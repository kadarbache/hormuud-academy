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
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
import { formatMoney } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { salaryTypeLabels } from "../finance/labels";
import { TeacherDialog } from "./teacher-dialog";
import { createTeacher, deleteTeacher, setTeacherActive, updateTeacher } from "./actions";

export const metadata: Metadata = { title: "Teachers" };

export default async function TeachersPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  // Branch staff see the teachers who work at their branch and the skills
  // they run there, read-only. Changes stay with the admin, and the actions
  // check that again on the server.
  const branchId = user.branchId ?? "";

  const [teachers, branches] = await Promise.all([
    prisma.teacher.findMany({
      where: isAdmin ? {} : { branches: { some: { branchId } } },
      orderBy: { name: "asc" },
      include: {
        branches: { include: { branch: { select: { name: true } } } },
        branchSkills: {
          where: isAdmin ? {} : { branchId },
          include: {
            skill: { select: { name: true } },
            branch: { select: { name: true } },
            classroom: { select: { name: true } },
          },
        },
      },
    }),
    isAdmin ? prisma.branch.findMany({ orderBy: { name: "asc" } }) : [],
  ]);

  const activeBranches = branches
    .filter((branch) => branch.active)
    .map((branch) => ({ value: branch.id, label: branch.name }));

  return (
    <>
      <PageHeader
        title="Teachers"
        description={
          isAdmin
            ? "Everyone who teaches, and the branches they work at."
            : "The teachers at your branch and the skills they teach here. Only the admin can change them."
        }
      >
        {isAdmin && (
          <TeacherDialog
            action={createTeacher}
            branches={activeBranches}
            trigger={
              <Button disabled={activeBranches.length === 0}>
                <Plus />
                Add teacher
              </Button>
            }
          />
        )}
      </PageHeader>

      {teachers.length === 0 ? (
        <EmptyRow
          message={
            !isAdmin
              ? "No teachers work at your branch yet."
              : activeBranches.length === 0
                ? "Add a branch first, then its teachers."
                : "No teachers yet."
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                {isAdmin && <TableHead>Branches</TableHead>}
                {isAdmin && <TableHead>Paid</TableHead>}
                <TableHead>Teaches</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => {
                const branchIds = teacher.branches.map((link) => link.branchId);
                // Keep a branch the teacher is linked to in the list even if
                // it's inactive, so saving the form doesn't silently drop it.
                const branchOptions = branches
                  .filter((branch) => branch.active || branchIds.includes(branch.id))
                  .map((branch) => ({ value: branch.id, label: branch.name }));

                return (
                  <TableRow key={teacher.id}>
                    <TableCell>
                      <div className="font-medium">{teacher.name}</div>
                      {teacher.phone && (
                        <div className="text-xs text-muted-foreground">{formatPhone(teacher.phone)}</div>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="whitespace-normal">
                        {teacher.branches.map((link) => link.branch.name).join(", ")}
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell>
                        <Link
                          href={`/finance/teacher-pay/${teacher.id}`}
                          className="hover:underline"
                        >
                          {salaryTypeLabels[teacher.salaryType]}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {teacher.salaryType === "PERCENTAGE"
                            ? teacher.percentageRate
                              ? `${teacher.percentageRate.toString()}% of monthly fees`
                              : "No rate set"
                            : `${formatMoney(teacher.fixedSalary?.toString() ?? "0")} a month`}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                      {teacher.branchSkills
                        .map((bs) =>
                          isAdmin
                            ? `${bs.skill.name} (${bs.branch.name})`
                            : `${bs.skill.name} in ${bs.classroom.name}`,
                        )
                        .join(", ") || "Nothing yet"}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={teacher.active} />
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <TeacherDialog
                            action={updateTeacher.bind(null, teacher.id)}
                            branches={branchOptions}
                            teacher={{
                              name: teacher.name,
                              phone: teacher.phone,
                              branchIds,
                              salaryType: teacher.salaryType,
                              fixedSalary: teacher.fixedSalary?.toString() ?? "",
                              percentageRate: teacher.percentageRate?.toString() ?? "",
                            }}
                            trigger={
                              <Button variant="ghost" size="sm">
                                Edit
                              </Button>
                            }
                          />
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            action={setTeacherActive.bind(null, teacher.id, !teacher.active)}
                          >
                            {teacher.active ? "Deactivate" : "Activate"}
                          </ActionButton>
                          {teacher.branchSkills.length === 0 && (
                            <ActionButton
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              action={deleteTeacher.bind(null, teacher.id)}
                              confirm={{
                                title: `Delete ${teacher.name}?`,
                                description:
                                  "This teacher isn't set on any skill, so they can be deleted for good.",
                                confirmLabel: "Delete teacher",
                                destructive: true,
                              }}
                            >
                              Delete
                            </ActionButton>
                          )}
                        </div>
                      </TableCell>
                    )}
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

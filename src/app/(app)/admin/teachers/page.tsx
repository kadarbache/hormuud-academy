import type { Metadata } from "next";
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
import { prisma } from "@/lib/prisma";
import { TeacherDialog } from "./teacher-dialog";
import { createTeacher, deleteTeacher, setTeacherActive, updateTeacher } from "./actions";

export const metadata: Metadata = { title: "Teachers" };

export default async function TeachersPage() {
  const [teachers, branches] = await Promise.all([
    prisma.teacher.findMany({
      orderBy: { name: "asc" },
      include: {
        branches: { include: { branch: { select: { name: true } } } },
        branchSkills: {
          include: { skill: { select: { name: true } }, branch: { select: { name: true } } },
        },
      },
    }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  const activeBranches = branches
    .filter((branch) => branch.active)
    .map((branch) => ({ value: branch.id, label: branch.name }));

  return (
    <>
      <PageHeader title="Teachers" description="Everyone who teaches, and the branches they work at.">
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
      </PageHeader>

      {teachers.length === 0 ? (
        <EmptyRow
          message={activeBranches.length === 0 ? "Add a branch first, then its teachers." : "No teachers yet."}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Branches</TableHead>
                <TableHead>Teaches</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
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
                        <div className="text-xs text-muted-foreground">{teacher.phone}</div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {teacher.branches.map((link) => link.branch.name).join(", ")}
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                      {teacher.branchSkills
                        .map((bs) => `${bs.skill.name} (${bs.branch.name})`)
                        .join(", ") || "Nothing yet"}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={teacher.active} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <TeacherDialog
                          action={updateTeacher.bind(null, teacher.id)}
                          branches={branchOptions}
                          teacher={{ name: teacher.name, phone: teacher.phone, branchIds }}
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
                              description: "This teacher isn't set on any skill, so they can be deleted for good.",
                              confirmLabel: "Delete teacher",
                              destructive: true,
                            }}
                          >
                            Delete
                          </ActionButton>
                        )}
                      </div>
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

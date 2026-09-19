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
import { requireUser } from "@/lib/session";
import { AddClassDialog, RenameClassDialog } from "./class-dialog";
import {
  createClassroom,
  deleteClassroom,
  renameClassroom,
  setClassroomActive,
} from "./actions";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  // Branch staff see their own branch's classes, read-only. Changes stay
  // with the admin, and the actions check that again on the server.
  const [classrooms, branches] = await Promise.all([
    prisma.classroom.findMany({
      where: isAdmin ? {} : { branchId: user.branchId ?? "" },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      include: {
        branch: { select: { name: true } },
        branchSkills: {
          select: { skill: { select: { name: true } }, teacher: { select: { name: true } } },
        },
      },
    }),
    isAdmin ? prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [],
  ]);

  return (
    <>
      <PageHeader
        title="Classes"
        description={
          isAdmin
            ? "The rooms at each branch. Every skill at a branch is taught in one class."
            : "The rooms at your branch and the skills taught in each. Only the admin can change them."
        }
      >
        {isAdmin && (
          <AddClassDialog
            action={createClassroom}
            branches={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            trigger={
              <Button disabled={branches.length === 0}>
                <Plus />
                Add class
              </Button>
            }
          />
        )}
      </PageHeader>

      {classrooms.length === 0 ? (
        <EmptyRow
          message={
            !isAdmin
              ? "Your branch has no classes yet."
              : branches.length === 0
                ? "Add a branch first, then its classes."
                : "No classes yet."
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                {isAdmin && <TableHead>Branch</TableHead>}
                <TableHead>Skills taught here</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {classrooms.map((classroom) => (
                <TableRow key={classroom.id}>
                  <TableCell className="font-medium">{classroom.name}</TableCell>
                  {isAdmin && <TableCell>{classroom.branch.name}</TableCell>}
                  <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                    {classroom.branchSkills
                      .map((bs) => `${bs.skill.name} (${bs.teacher.name})`)
                      .join(", ") || "None"}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={classroom.active} />
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <RenameClassDialog
                          action={renameClassroom.bind(null, classroom.id)}
                          name={classroom.name}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Rename
                            </Button>
                          }
                        />
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          action={setClassroomActive.bind(null, classroom.id, !classroom.active)}
                        >
                          {classroom.active ? "Deactivate" : "Activate"}
                        </ActionButton>
                        {classroom.branchSkills.length === 0 && (
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            action={deleteClassroom.bind(null, classroom.id)}
                            confirm={{
                              title: `Delete ${classroom.name}?`,
                              description: "No skill is taught in this class, so it can be deleted for good.",
                              confirmLabel: "Delete class",
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

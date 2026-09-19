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
import { AddClassDialog, RenameClassDialog } from "./class-dialog";
import {
  createClassroom,
  deleteClassroom,
  renameClassroom,
  setClassroomActive,
} from "./actions";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const [classrooms, branches] = await Promise.all([
    prisma.classroom.findMany({
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      include: {
        branch: { select: { name: true } },
        branchSkills: { select: { skill: { select: { name: true } } } },
      },
    }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Classes" description="The rooms at each branch. Every skill at a branch is taught in one class.">
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
      </PageHeader>

      {classrooms.length === 0 ? (
        <EmptyRow
          message={branches.length === 0 ? "Add a branch first, then its classes." : "No classes yet."}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Skills taught here</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classrooms.map((classroom) => (
                <TableRow key={classroom.id}>
                  <TableCell className="font-medium">{classroom.name}</TableCell>
                  <TableCell>{classroom.branch.name}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                    {classroom.branchSkills.map((bs) => bs.skill.name).join(", ") || "None"}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={classroom.active} />
                  </TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

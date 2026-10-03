import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
import { formatSlot } from "@/lib/class-times";
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
        classTimes: {
          select: {
            active: true,
            days: true,
            startMinute: true,
            endMinute: true,
            enrollments: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
            branchSkill: { select: { skill: { select: { name: true } } } },
            teacher: { select: { name: true } },
          },
          orderBy: { startMinute: "asc" },
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
            ? "The rooms at each branch. A class holds different skills at different times, set as class times on the Skills page. Open a class to see its week."
            : "The rooms at your branch and the class times in each. Open a class to see its week. Only the admin can change them."
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
        <DataTable
          columns={[
            { label: "Class", className: "font-medium" },
            ...(isAdmin ? [{ label: "Branch" }] : []),
            {
              label: "Class times",
              className: "max-w-96 whitespace-normal text-muted-foreground",
            },
            { label: "Status" },
            ...(isAdmin ? [{ label: "Actions", actions: true, className: "text-right" }] : []),
          ]}
          rows={classrooms.map((classroom) => ({
            key: classroom.id,
            title: classroom.name,
            description: isAdmin ? classroom.branch.name : undefined,
            cells: {
              Class: (
                <Link href={`/classes/${classroom.id}`} className="hover:underline">
                  {classroom.name}
                </Link>
              ),
              Branch: classroom.branch.name,
              // What still meets here: class times that are active or still
              // have students.
              "Class times":
                classroom.classTimes
                  .filter((classTime) => classTime.active || classTime.enrollments.length > 0)
                  .map(
                    (classTime) =>
                      `${classTime.branchSkill.skill.name}, ${formatSlot(classTime)} (${classTime.teacher.name})`,
                  )
                  .join("; ") || "None",
              Status: <ActiveBadge active={classroom.active} />,
              Actions: (
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
                  {classroom.classTimes.length === 0 && (
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      action={deleteClassroom.bind(null, classroom.id)}
                      confirm={{
                        title: `Delete ${classroom.name}?`,
                        description: "No class time uses this class, so it can be deleted for good.",
                        confirmLabel: "Delete class",
                        destructive: true,
                      }}
                    >
                      Delete
                    </ActionButton>
                  )}
                </div>
              ),
            },
          }))}
        />
      )}
    </>
  );
}

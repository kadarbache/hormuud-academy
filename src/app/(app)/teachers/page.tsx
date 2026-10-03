import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
import { formatHours, slotOf } from "@/lib/class-times";
import { currentRate } from "@/lib/exchange-rate";
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

  const [teachers, branches, rate] = await Promise.all([
    prisma.teacher.findMany({
      where: isAdmin ? {} : { branches: { some: { branchId } } },
      orderBy: { name: "asc" },
      include: {
        branches: { include: { branch: { select: { name: true } } } },
        classTimes: {
          include: {
            classroom: { select: { name: true } },
            enrollments: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
            branchSkill: {
              select: {
                branchId: true,
                skill: { select: { name: true } },
                branch: { select: { name: true } },
              },
            },
          },
          orderBy: { startMinute: "asc" },
        },
      },
    }),
    isAdmin ? prisma.branch.findMany({ orderBy: { name: "asc" } }) : [],
    isAdmin ? currentRate() : null,
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
            rate={rate}
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
        <DataTable
          columns={[
            { label: "Teacher" },
            ...(isAdmin ? [{ label: "Branches", className: "whitespace-normal" }] : []),
            ...(isAdmin ? [{ label: "Paid" }] : []),
            { label: "Teaches", className: "max-w-72 whitespace-normal text-muted-foreground" },
            { label: "Status" },
            ...(isAdmin ? [{ label: "Actions", actions: true, className: "text-right" }] : []),
          ]}
          rows={teachers.map((teacher) => {
            const branchIds = teacher.branches.map((link) => link.branchId);
            // Keep a branch the teacher is linked to in the list even if
            // it's inactive, so saving the form doesn't silently drop it.
            const branchOptions = branches
              .filter((branch) => branch.active || branchIds.includes(branch.id))
              .map((branch) => ({ value: branch.id, label: branch.name }));

            return {
              key: teacher.id,
              title: teacher.name,
              description: teacher.phone ? formatPhone(teacher.phone) : undefined,
              cells: {
                Teacher: (
                  <>
                    <div className="font-medium">{teacher.name}</div>
                    {teacher.phone && (
                      <div className="text-xs text-muted-foreground">{formatPhone(teacher.phone)}</div>
                    )}
                  </>
                ),
                Branches: teacher.branches.map((link) => link.branch.name).join(", "),
                Paid: (
                  <>
                    <Link href={`/finance/teacher-pay/${teacher.id}`} className="hover:underline">
                      {salaryTypeLabels[teacher.salaryType]}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {teacher.salaryType === "PERCENTAGE"
                        ? teacher.percentageRate
                          ? `${teacher.percentageRate.toString()}% of monthly fees`
                          : "No rate set"
                        : `${formatMoney(teacher.fixedSalary?.toString() ?? "0", teacher.salaryCurrency)} a month`}
                    </div>
                  </>
                ),
                // What they still teach: class times that are active or still
                // have students. Branch staff see their own branch's.
                Teaches:
                  teacher.classTimes
                    .filter(
                      (classTime) =>
                        (classTime.active || classTime.enrollments.length > 0) &&
                        (isAdmin || classTime.branchSkill.branchId === branchId),
                    )
                    .map((classTime) => {
                      const slot = slotOf(classTime);
                      const hours = slot ? formatHours(slot) : "time not set";
                      return isAdmin
                        ? `${classTime.branchSkill.skill.name} (${classTime.branchSkill.branch.name}, ${hours})`
                        : `${classTime.branchSkill.skill.name} in ${classTime.classroom.name}, ${hours}`;
                    })
                    .join("; ") || "Nothing yet",
                Status: <ActiveBadge active={teacher.active} />,
                Actions: (
                  <div className="flex justify-end gap-1">
                    <TeacherDialog
                      action={updateTeacher.bind(null, teacher.id)}
                      branches={branchOptions}
                      rate={rate}
                      teacher={{
                        name: teacher.name,
                        phone: teacher.phone,
                        branchIds,
                        salaryType: teacher.salaryType,
                        fixedSalary: teacher.fixedSalary?.toString() ?? "",
                        salaryCurrency: teacher.salaryCurrency,
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
                    {teacher.classTimes.length === 0 && (
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        action={deleteTeacher.bind(null, teacher.id)}
                        confirm={{
                          title: `Delete ${teacher.name}?`,
                          description:
                            "This teacher isn't set on any class time, so they can be deleted for good.",
                          confirmLabel: "Delete teacher",
                          destructive: true,
                        }}
                      >
                        Delete
                      </ActionButton>
                    )}
                  </div>
                ),
              },
            };
          })}
        />
      )}
    </>
  );
}

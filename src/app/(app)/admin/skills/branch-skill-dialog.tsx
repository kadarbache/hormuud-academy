"use client";

import { useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

export type TeacherOption = { id: string; name: string; branchIds: string[] };
export type ClassroomOption = { id: string; name: string; branchId: string };

/**
 * Sets which teacher and class a skill uses at one branch. When adding, the
 * teacher and class lists follow the branch picked above them.
 */
export function BranchSkillDialog({
  action,
  branches,
  teachers,
  classrooms,
  current,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  /** Branches that can be picked. Ignored when editing. */
  branches: Option[];
  teachers: TeacherOption[];
  classrooms: ClassroomOption[];
  current?: { branchId: string; branchName: string; teacherId: string; classroomId: string };
  trigger: React.ReactNode;
}) {
  const [branchId, setBranchId] = useState(current?.branchId ?? "");

  const teacherOptions = teachers
    .filter((teacher) => teacher.branchIds.includes(branchId))
    .map((teacher) => ({ value: teacher.id, label: teacher.name }));
  const classroomOptions = classrooms
    .filter((classroom) => classroom.branchId === branchId)
    .map((classroom) => ({ value: classroom.id, label: classroom.name }));

  return (
    <FormDialog
      title={current ? `Teacher and class at ${current.branchName}` : "Add to a branch"}
      trigger={trigger}
      action={action}
      submitLabel={current ? "Save" : "Add to branch"}
    >
      {(errors) => (
        <>
          {current ? (
            <Field>
              <FieldLabel>Branch</FieldLabel>
              <p className="text-sm">{current.branchName}</p>
            </Field>
          ) : (
            <SelectField
              label="Branch"
              name="branchId"
              options={branches}
              placeholder="Pick a branch"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              errors={errors.branchId}
            />
          )}
          {/* Keyed on the branch so a new branch clears the old picks. */}
          <SelectField
            key={`teacher-${branchId}`}
            label="Teacher"
            name="teacherId"
            options={teacherOptions}
            placeholder={branchId ? "Pick a teacher" : "Pick a branch first"}
            defaultValue={current?.teacherId ?? ""}
            disabled={!branchId}
            description={
              branchId && teacherOptions.length === 0
                ? "No active teacher works at this branch. Add one on the Teachers page."
                : undefined
            }
            errors={errors.teacherId}
          />
          <SelectField
            key={`class-${branchId}`}
            label="Class"
            name="classroomId"
            options={classroomOptions}
            placeholder={branchId ? "Pick a class" : "Pick a branch first"}
            defaultValue={current?.classroomId ?? ""}
            disabled={!branchId}
            description={
              branchId && classroomOptions.length === 0
                ? "This branch has no active classes. Add one on the Classes page."
                : undefined
            }
            errors={errors.classroomId}
          />
        </>
      )}
    </FormDialog>
  );
}

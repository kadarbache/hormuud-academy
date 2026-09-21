"use client";

import { useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

export type TeacherOption = { id: string; name: string; branchIds: string[] };
export type ClassroomOption = { id: string; name: string; branchId: string };
export type Pricing = { durationMonths: number; registrationFee: string; monthlyFee: string };

/**
 * Sets the teacher, class, fees and duration a skill has at one branch. When
 * adding, the teacher and class lists follow the branch picked above them,
 * and the fees and duration start at the skill's defaults.
 */
export function BranchSkillDialog({
  action,
  branches,
  teachers,
  classrooms,
  current,
  pricing,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  /** Branches that can be picked. Ignored when editing. */
  branches: Option[];
  teachers: TeacherOption[];
  classrooms: ClassroomOption[];
  current?: { branchId: string; branchName: string; teacherId: string; classroomId: string };
  /** The branch's own values when editing, the skill's defaults when adding. */
  pricing: Pricing;
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
      title={current ? `Set up at ${current.branchName}` : "Add to a branch"}
      description={
        current
          ? "A new fee or duration applies to students who join from now on. Current students keep theirs."
          : "The fees and duration start at the skill's defaults. Change them for this branch if it charges differently."
      }
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
              onValueChange={setBranchId}
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
          <TextField
            label="Duration in months"
            name="durationMonths"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            step={1}
            defaultValue={pricing.durationMonths}
            required
            errors={errors.durationMonths}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Registration fee (USD)"
              name="registrationFee"
              inputMode="decimal"
              defaultValue={pricing.registrationFee}
              description="0 if none."
              required
              errors={errors.registrationFee}
            />
            <TextField
              label="Monthly fee (USD)"
              name="monthlyFee"
              inputMode="decimal"
              defaultValue={pricing.monthlyFee}
              required
              errors={errors.monthlyFee}
            />
          </div>
        </>
      )}
    </FormDialog>
  );
}

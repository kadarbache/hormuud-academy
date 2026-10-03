"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { Weekday } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { WEEKDAYS } from "@/lib/class-times";

/** What one branch offers a class time to pick from: its active classes and teachers. */
export type BranchChoices = { classrooms: Option[]; teachers: Option[] };

function DayCheckboxes({ checked, errors }: { checked: Weekday[]; errors?: string[] }) {
  const id = useId();
  return (
    <FieldSet data-invalid={errors?.length ? true : undefined}>
      <FieldLegend variant="label">Days</FieldLegend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {WEEKDAYS.map((day) => (
          <Field key={day.value} orientation="horizontal">
            <Checkbox
              id={`${id}-${day.value}`}
              name="days"
              value={day.value}
              defaultChecked={checked.includes(day.value)}
            />
            <FieldLabel htmlFor={`${id}-${day.value}`} className="font-normal">
              {day.short}
            </FieldLabel>
          </Field>
        ))}
      </div>
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </FieldSet>
  );
}

/** "No active class at this branch. Add one on the Classes page." */
function missing(options: Option[], what: string, page: string) {
  return options.length === 0 ? `No active ${what} at this branch. Add one on the ${page} page.` : undefined;
}

/**
 * Where, when and by whom a skill is taught at one branch: a class, the
 * hours, the days, and a teacher. The lists only hold that branch's.
 */
export function ClassTimeDialog({
  action,
  branchName,
  choices,
  current,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  branchName: string;
  choices: BranchChoices;
  /** The class time being changed, its hours as the time boxes hold them ("16:00"). Left out when adding. */
  current?: { classroomId: string; teacherId: string; start: string; end: string; days: Weekday[] };
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={current ? `Change class time at ${branchName}` : `Add class time at ${branchName}`}
      description={
        current
          ? "Its students move with it. A new teacher earns from fees paid from now on."
          : "The class can't hold another skill, and the teacher can't be teaching elsewhere, at the same time."
      }
      trigger={trigger}
      action={action}
      submitLabel={current ? "Save" : "Add class time"}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Starts"
              name="startTime"
              type="time"
              step={300}
              defaultValue={current?.start}
              required
              errors={errors.startTime}
            />
            <TextField
              label="Ends"
              name="endTime"
              type="time"
              step={300}
              defaultValue={current?.end}
              required
              errors={errors.endTime}
            />
          </div>
          <DayCheckboxes checked={current?.days ?? []} errors={errors.days} />
          <SelectField
            label="Class"
            name="classroomId"
            options={choices.classrooms}
            placeholder="Pick a class"
            defaultValue={current?.classroomId ?? ""}
            description={missing(choices.classrooms, "class", "Classes")}
            errors={errors.classroomId}
          />
          <SelectField
            label="Teacher"
            name="teacherId"
            options={choices.teachers}
            placeholder="Pick a teacher"
            defaultValue={current?.teacherId ?? ""}
            description={missing(choices.teachers, "teacher", "Teachers")}
            errors={errors.teacherId}
          />
        </>
      )}
    </FormDialog>
  );
}

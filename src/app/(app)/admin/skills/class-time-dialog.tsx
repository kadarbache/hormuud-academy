"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { Weekday } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { WEEKDAYS } from "@/lib/class-times";

/** What one branch offers a class time to pick from: its active teachers. */
export type BranchChoices = { teachers: Option[] };

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

/** "No active teacher at this branch. Add one on the Teachers page." */
function missing(options: Option[], what: string, page: string) {
  return options.length === 0 ? `No active ${what} at this branch. Add one on the ${page} page.` : undefined;
}

/**
 * When and by whom a skill is taught at one branch: a name, the hours, the
 * days, and a teacher. The list only holds that branch's teachers.
 */
export function ClassTimeDialog({
  action,
  branchName,
  choices,
  suggestedName,
  current,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  branchName: string;
  choices: BranchChoices;
  /** The name a new class time starts with, like the next number. */
  suggestedName?: string;
  /** The class time being changed, its hours as the time boxes hold them ("16:00"). Left out when adding. */
  current?: { name: string; teacherId: string; start: string; end: string; days: Weekday[] };
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={current ? `Change class time at ${branchName}` : `Add class time at ${branchName}`}
      description={
        current
          ? "Its students move with it. A new teacher earns from fees paid from now on."
          : "The teacher can't be teaching anything else at the same time, except this skill at exactly the same hours and days."
      }
      trigger={trigger}
      action={action}
      submitLabel={current ? "Save" : "Add class time"}
    >
      {(errors) => (
        <>
          <TextField
            label="Name"
            name="name"
            defaultValue={current?.name ?? suggestedName ?? ""}
            maxLength={40}
            required
            description="A short name, like 1 or 2, shown after the skill: Computer Basics 1."
            errors={errors.name}
          />
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
            label="Teacher"
            name="teacherId"
            options={choices.teachers}
            placeholder="Pick a teacher"
            defaultValue={current?.teacherId ?? ""}
            description={
              missing(choices.teachers, "teacher", "Teachers") ??
              "The same teacher can take class times of this skill at exactly the same hours and days, like 1 and 2."
            }
            errors={errors.teacherId}
          />
        </>
      )}
    </FormDialog>
  );
}

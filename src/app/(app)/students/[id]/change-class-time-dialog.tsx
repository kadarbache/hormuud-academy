"use client";

import { FormDialog } from "@/components/form-dialog";
import { SelectField } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { classTimeText } from "../student-fields";
import type { ClassTimeOption } from "../types";

/**
 * Moves the student to another of a skill's class times. Only the class
 * time changes: fees, dates and payments stay as they are.
 */
export function ChangeClassTimeDialog({
  action,
  skillName,
  current,
  options,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  skillName: string;
  /** "4:00–6:00 pm, Sat Mon Wed in Room 3 with Ali" */
  current: string;
  /** The skill's other class times taking students. */
  options: ClassTimeOption[];
  trigger: React.ReactNode;
}) {
  const [only] = options.length === 1 ? options : [];

  return (
    <FormDialog
      title={`Change the ${skillName} class time`}
      description={`Now ${current}. The fees, dates and payments stay the same.`}
      trigger={trigger}
      action={action}
      submitLabel="Move student"
    >
      {(errors) => (
        <SelectField
          label="New class time"
          name="classTimeId"
          options={options.map((classTime) => ({
            value: classTime.id,
            label: classTimeText(classTime),
          }))}
          placeholder="Pick a class time"
          defaultValue={only?.id ?? ""}
          description="A teacher paid by percentage earns from the fees paid after the move."
          errors={errors.classTimeId}
        />
      )}
    </FormDialog>
  );
}

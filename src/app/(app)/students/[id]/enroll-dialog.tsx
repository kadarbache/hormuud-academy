"use client";

import { useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { addMonths, formatDate, isIsoDate } from "@/lib/dates";
import { feesText, RegistrationFeePaidField } from "../student-fields";
import type { BranchSkillOption } from "../types";

export function EnrollDialog({
  action,
  options,
  today,
  showBranch,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  options: BranchSkillOption[];
  today: string;
  /** Admins pick from every branch, so each option names its branch. */
  showBranch: boolean;
  trigger: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [startDate, setStartDate] = useState(today);
  const selected = options.find((option) => option.id === selectedId);

  return (
    <FormDialog
      title="Add a skill"
      description="The student joins the skill at the branch that teaches it."
      trigger={trigger}
      action={action}
      submitLabel="Add skill"
      onSuccess={() => setSelectedId("")}
    >
      {(errors) => (
        <>
          <SelectField
            label="Skill"
            name="branchSkillId"
            options={options.map((option) => ({
              value: option.id,
              label: showBranch ? `${option.skillName} (${option.branchName})` : option.skillName,
            }))}
            placeholder="Pick a skill"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            errors={errors.branchSkillId}
          />
          <TextField
            label="Start date"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
            errors={errors.startDate}
          />
          {selected && isIsoDate(startDate) && (
            <p className="rounded-md bg-muted p-3 text-sm">
              {selected.teacherName} teaches it in {selected.classroomName}. {feesText(selected)}. It
              ends around {formatDate(addMonths(startDate, selected.durationMonths))}.
            </p>
          )}
          {selected && (
            <RegistrationFeePaidField
              skills={[selected]}
              description="Tick it if the student paid now. If they'll pay later, record it on this page once they do."
            />
          )}
        </>
      )}
    </FormDialog>
  );
}

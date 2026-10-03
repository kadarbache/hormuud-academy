"use client";

import { useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { addMonths, formatDate, isIsoDate } from "@/lib/dates";
import {
  ClassTimeField,
  classTimeText,
  feesText,
  RegistrationFeePaidField,
} from "../student-fields";
import type { BranchSkillOption } from "../types";

export function EnrollDialog({
  action,
  options,
  rate,
  today,
  showBranch,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  options: BranchSkillOption[];
  /** Shillings to the dollar right now, or null before the admin sets it. */
  rate: string | null;
  today: string;
  /** Admins pick from every branch, so each option names its branch. */
  showBranch: boolean;
  trigger: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [startDate, setStartDate] = useState(today);
  // A skill with no class time has nowhere for the student to sit yet.
  const open = options.filter((option) => option.classTimes.length > 0);
  const waiting = options.filter((option) => option.classTimes.length === 0);
  const selected = open.find((option) => option.id === selectedId);
  const [only] = selected?.classTimes.length === 1 ? selected.classTimes : [];
  const nameOf = (option: BranchSkillOption) =>
    showBranch ? `${option.skillName} (${option.branchName})` : option.skillName;

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
            options={open.map((option) => ({ value: option.id, label: nameOf(option) }))}
            placeholder="Pick a skill"
            value={selectedId}
            onValueChange={setSelectedId}
            description={
              waiting.length > 0
                ? `Not listed until the admin gives them a class time: ${waiting.map(nameOf).join(", ")}.`
                : undefined
            }
            errors={errors.branchSkillId}
          />
          {selected && (
            <ClassTimeField
              key={selected.id}
              option={selected}
              name="classTimeId"
              errors={errors.classTimeId}
            />
          )}
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
              {only && `${classTimeText(only)}. `}
              {feesText(selected)}. It ends around{" "}
              {formatDate(addMonths(startDate, selected.durationMonths))}.
            </p>
          )}
          {selected && (
            <RegistrationFeePaidField
              skills={[selected]}
              rate={rate}
              description="Tick it if the student paid now. If they'll pay later, record it on this page once they do."
              errors={{
                method: errors.registrationFeeMethod,
                currency: errors.registrationFeeCurrency,
              }}
            />
          )}
        </>
      )}
    </FormDialog>
  );
}

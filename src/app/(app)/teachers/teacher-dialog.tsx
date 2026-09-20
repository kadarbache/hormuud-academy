"use client";

import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { salaryTypeOptions } from "../finance/labels";

function BranchCheckboxes({
  branches,
  checked,
  errors,
}: {
  branches: Option[];
  checked: string[];
  errors?: string[];
}) {
  const id = useId();
  return (
    <FieldSet data-invalid={errors?.length ? true : undefined}>
      <FieldLegend variant="label">Branches they work at</FieldLegend>
      <div className="grid gap-2 sm:grid-cols-2">
        {branches.map((branch) => (
          <Field key={branch.value} orientation="horizontal">
            <Checkbox
              id={`${id}-${branch.value}`}
              name="branchIds"
              value={branch.value}
              defaultChecked={checked.includes(branch.value)}
            />
            <FieldLabel htmlFor={`${id}-${branch.value}`} className="font-normal">
              {branch.label}
            </FieldLabel>
          </Field>
        ))}
      </div>
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </FieldSet>
  );
}

export function TeacherDialog({
  action,
  branches,
  teacher,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  branches: Option[];
  teacher?: {
    name: string;
    phone: string | null;
    branchIds: string[];
    salaryType: string;
    fixedSalary: string;
    percentageRate: string;
  };
  trigger: React.ReactNode;
}) {
  const [salaryType, setSalaryType] = useState(teacher?.salaryType ?? "FIXED");

  return (
    <FormDialog
      title={teacher ? "Edit teacher" : "Add teacher"}
      trigger={trigger}
      action={action}
      submitLabel={teacher ? "Save" : "Add teacher"}
    >
      {(errors) => (
        <>
          <TextField label="Name" name="name" defaultValue={teacher?.name} required errors={errors.name} />
          <TextField
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={teacher?.phone ?? ""}
            errors={errors.phone}
          />
          <BranchCheckboxes
            branches={branches}
            checked={teacher?.branchIds ?? []}
            errors={errors.branchIds}
          />
          <SelectField
            label="How they're paid"
            name="salaryType"
            options={salaryTypeOptions}
            value={salaryType}
            onValueChange={setSalaryType}
            errors={errors.salaryType}
          />
          {salaryType === "FIXED" ? (
            <TextField
              label="Monthly salary (USD)"
              name="fixedSalary"
              inputMode="decimal"
              defaultValue={teacher?.fixedSalary ?? ""}
              placeholder="200"
              description="Paid every month whatever their students pay."
              required
              errors={errors.fixedSalary}
            />
          ) : (
            <TextField
              label="Percentage of monthly fees"
              name="percentageRate"
              inputMode="decimal"
              defaultValue={teacher?.percentageRate ?? ""}
              placeholder="30"
              description="30 means they earn 30% of every monthly fee their students pay. Changing it only affects what they earn from now on."
              required
              errors={errors.percentageRate}
            />
          )}
        </>
      )}
    </FormDialog>
  );
}

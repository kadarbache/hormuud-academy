"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { FormDialog } from "@/components/form-dialog";
import { TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

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
  teacher?: { name: string; phone: string | null; branchIds: string[] };
  trigger: React.ReactNode;
}) {
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
        </>
      )}
    </FormDialog>
  );
}

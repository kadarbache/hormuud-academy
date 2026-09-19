"use client";

import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

export function AddClassDialog({
  action,
  branches,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  branches: Option[];
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog title="Add class" trigger={trigger} action={action} submitLabel="Add class">
      {(errors) => (
        <>
          <SelectField
            label="Branch"
            name="branchId"
            options={branches}
            placeholder="Pick a branch"
            defaultValue=""
            errors={errors.branchId}
          />
          <TextField label="Class name" name="name" placeholder="Room 3" required errors={errors.name} />
        </>
      )}
    </FormDialog>
  );
}

export function RenameClassDialog({
  action,
  name,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  name: string;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog title="Rename class" trigger={trigger} action={action}>
      {(errors) => (
        <TextField label="Class name" name="name" defaultValue={name} required errors={errors.name} />
      )}
    </FormDialog>
  );
}

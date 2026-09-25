"use client";

import { FormDialog } from "@/components/form-dialog";
import { TextField } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

export function ExpenseCategoryDialog({
  action,
  category,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  category?: { name: string };
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={category ? "Rename expense category" : "Add expense category"}
      description={
        category
          ? "The new name shows everywhere, on past expenses too."
          : undefined
      }
      trigger={trigger}
      action={action}
      submitLabel={category ? "Save" : "Add category"}
    >
      {(errors) => (
        <TextField
          label="Name"
          name="name"
          defaultValue={category?.name}
          placeholder="Security"
          required
          errors={errors.name}
        />
      )}
    </FormDialog>
  );
}

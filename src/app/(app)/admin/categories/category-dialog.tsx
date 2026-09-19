"use client";

import { FormDialog } from "@/components/form-dialog";
import { TextField } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

export function CategoryDialog({
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
      title={category ? "Rename category" : "Add category"}
      trigger={trigger}
      action={action}
      submitLabel={category ? "Save" : "Add category"}
    >
      {(errors) => (
        <TextField
          label="Name"
          name="name"
          defaultValue={category?.name}
          placeholder="Technology Skills"
          required
          errors={errors.name}
        />
      )}
    </FormDialog>
  );
}

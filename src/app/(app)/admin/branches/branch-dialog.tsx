"use client";

import { FormDialog } from "@/components/form-dialog";
import { TextField } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

export function BranchDialog({
  action,
  branch,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  branch?: { name: string; phone: string | null; address: string | null };
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={branch ? "Edit branch" : "Add branch"}
      trigger={trigger}
      action={action}
      submitLabel={branch ? "Save" : "Add branch"}
    >
      {(errors) => (
        <>
          <TextField label="Name" name="name" defaultValue={branch?.name} required errors={errors.name} />
          <TextField
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={branch?.phone ?? ""}
            errors={errors.phone}
          />
          <TextField label="Address" name="address" defaultValue={branch?.address ?? ""} errors={errors.address} />
        </>
      )}
    </FormDialog>
  );
}

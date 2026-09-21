"use client";

import { FormDialog } from "@/components/form-dialog";
import { PhoneField, TextField } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { phoneEntry } from "@/lib/phone";

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
          <PhoneField
            label="Phone"
            name="phone"
            defaultValue={phoneEntry(branch?.phone)}
            description="Optional. The number people call to reach this branch."
            errors={errors.phone}
          />
          <TextField
            label="Address"
            name="address"
            defaultValue={branch?.address ?? ""}
            description="Optional."
            errors={errors.address}
          />
        </>
      )}
    </FormDialog>
  );
}

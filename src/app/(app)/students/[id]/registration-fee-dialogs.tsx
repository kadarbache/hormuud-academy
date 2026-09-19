"use client";

import { FormDialog } from "@/components/form-dialog";
import { TextField } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

/** Records the day the student paid one skill's registration fee. */
export function RecordPaymentDialog({
  action,
  skillName,
  fee,
  today,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  skillName: string;
  /** Already formatted, like "$10.00". */
  fee: string;
  today: string;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title="Record the registration fee"
      description={`${skillName}: ${fee}. Only record it once the student has paid.`}
      trigger={trigger}
      action={action}
      submitLabel="Record payment"
    >
      {(errors) => (
        <TextField
          label="Paid on"
          name="paidOn"
          type="date"
          max={today}
          defaultValue={today}
          required
          errors={errors.paidOn}
        />
      )}
    </FormDialog>
  );
}

/** Lets the admin lower or waive one student's registration fee for one skill. */
export function ChangeFeeDialog({
  action,
  skillName,
  fee,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  skillName: string;
  /** The amount now, like "10.00". */
  fee: string;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title="Change the registration fee"
      description={`Only this student's fee for ${skillName} changes. Enter 0 to waive it.`}
      trigger={trigger}
      action={action}
      submitLabel="Save"
    >
      {(errors) => (
        <TextField
          label="Registration fee (USD)"
          name="registrationFee"
          inputMode="decimal"
          defaultValue={fee}
          required
          errors={errors.registrationFee}
        />
      )}
    </FormDialog>
  );
}

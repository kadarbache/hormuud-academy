"use client";

import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { paymentMethodOptions } from "../../finance/labels";

/** Records the registration fee one student paid for one skill. */
export function RecordRegistrationFeeDialog({
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
        <>
          <TextField
            label="Paid on"
            name="paidOn"
            type="date"
            max={today}
            defaultValue={today}
            required
            errors={errors.paidOn}
          />
          <SelectField
            label="Paid by"
            name="method"
            options={paymentMethodOptions}
            placeholder="Pick one"
            errors={errors.method}
          />
        </>
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

/**
 * Records one month of one skill. The month is fixed by the button that
 * opened this, so it can't be paid twice or aimed at the wrong one. The
 * amount starts at the fee the student joined at and can be lowered for a
 * discount; whatever is entered settles that month.
 */
export function RecordMonthlyFeeDialog({
  action,
  skillName,
  month,
  monthLabel,
  monthlyFee,
  today,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  skillName: string;
  /** YYYY-MM. */
  month: string;
  /** "Sept 2026" */
  monthLabel: string;
  /** The amount owed, like "20.00". */
  monthlyFee: string;
  today: string;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={`${monthLabel} for ${skillName}`}
      description="Recording this marks the month paid. A percentage-paid teacher earns their share of it straight away."
      trigger={trigger}
      action={action}
      submitLabel="Record payment"
    >
      {(errors) => (
        <>
          <input type="hidden" name="month" value={month} />
          <TextField
            label="Amount paid (USD)"
            name="amount"
            inputMode="decimal"
            defaultValue={monthlyFee}
            description="The monthly fee this student joined at. Lower it if they were given a discount."
            required
            errors={errors.amount}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Paid on"
              name="paidOn"
              type="date"
              max={today}
              defaultValue={today}
              required
              errors={errors.paidOn}
            />
            <SelectField
              label="Paid by"
              name="method"
              options={paymentMethodOptions}
              placeholder="Pick one"
              errors={errors.method}
            />
          </div>
          {errors.month && <p className="text-sm text-destructive">{errors.month[0]}</p>}
        </>
      )}
    </FormDialog>
  );
}

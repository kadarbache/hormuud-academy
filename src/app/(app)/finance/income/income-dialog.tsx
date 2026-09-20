"use client";

import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { paymentMethodOptions, walkInIncomeOptions } from "../labels";

/**
 * Money taken at the counter that isn't a fee: books, an examination fee, or
 * anything else. Registration and monthly fees are recorded on the student's
 * own page, where the amount and the skill are already known.
 */
export function IncomeDialog({
  action,
  branches,
  today,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  /** The branches this user may record income at. One means no picker. */
  branches: Option[];
  today: string;
  trigger: React.ReactNode;
}) {
  const onlyBranch = branches.length === 1 ? branches[0].value : null;

  return (
    <FormDialog
      title="Record income"
      description="For books, examination fees and anything else paid over the counter."
      trigger={trigger}
      action={action}
      submitLabel="Record income"
    >
      {(errors) => (
        <>
          <SelectField
            label="What for"
            name="category"
            options={walkInIncomeOptions}
            placeholder="Pick one"
            errors={errors.category}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Amount (USD)"
              name="amount"
              inputMode="decimal"
              placeholder="30"
              required
              errors={errors.amount}
            />
            <SelectField
              label="Paid by"
              name="method"
              options={paymentMethodOptions}
              placeholder="Pick one"
              errors={errors.method}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Received on"
              name="paidOn"
              type="date"
              max={today}
              defaultValue={today}
              required
              errors={errors.paidOn}
            />
            {onlyBranch ? (
              <input type="hidden" name="branchId" value={onlyBranch} />
            ) : (
              <SelectField
                label="Branch"
                name="branchId"
                options={branches}
                placeholder="Pick a branch"
                errors={errors.branchId}
              />
            )}
          </div>
          <TextField
            label="Student ID"
            name="student"
            placeholder="STU-00042"
            description="Optional. Fill it in to show this payment on the student's record."
            errors={errors.student}
          />
          <TextField
            label="Note"
            name="note"
            placeholder="Two textbooks"
            errors={errors.note}
          />
        </>
      )}
    </FormDialog>
  );
}

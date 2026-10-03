"use client";

import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { formatMoney, formatRate } from "@/lib/format";
import { amountForInput, dollarsToShillings } from "@/lib/money";
import { AmountFields, CurrencyField } from "../../finance/amount-fields";
import { paymentMethodOptions } from "../../finance/labels";

/**
 * Records the registration fee one student paid for one skill. The fee is set
 * in dollars; paid in shillings, it's the fee at today's rate.
 */
export function RecordRegistrationFeeDialog({
  action,
  skillName,
  fee,
  rate,
  today,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  skillName: string;
  /** The fee in dollars, like "10.00". */
  fee: string;
  /** Shillings to the dollar right now, or null before the admin sets it. */
  rate: string | null;
  today: string;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title="Record the registration fee"
      description={`${skillName}: ${formatMoney(fee)}. Only record it once the student has paid.`}
      trigger={trigger}
      action={action}
      submitLabel="Record payment"
    >
      {(errors) => (
        <>
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
          <CurrencyField rate={rate} errors={errors.currency}>
            {(currency) =>
              currency === "SLSH" &&
              rate && (
                <p className="text-sm text-muted-foreground">
                  That&apos;s {formatMoney(dollarsToShillings(fee, rate), "SLSH")} at today&apos;s
                  rate of {formatRate(rate)} shillings to the dollar.
                </p>
              )
            }
          </CurrencyField>
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
 * amount starts at the fee the student joined at, in dollars or at today's
 * rate in shillings, and can be lowered for a discount; whatever is entered
 * settles that month.
 */
export function RecordMonthlyFeeDialog({
  action,
  skillName,
  month,
  monthLabel,
  monthlyFee,
  rate,
  today,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  skillName: string;
  /** YYYY-MM. */
  month: string;
  /** "Sept 2026" */
  monthLabel: string;
  /** The amount owed in dollars, like "20.00". */
  monthlyFee: string;
  /** Shillings to the dollar right now, or null before the admin sets it. */
  rate: string | null;
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
          <AmountFields
            label="Amount paid"
            rate={rate}
            defaultAmounts={{
              USD: amountForInput(monthlyFee, "USD"),
              SLSH: rate ? dollarsToShillings(monthlyFee, rate) : "",
            }}
            description="The monthly fee this student joined at. Lower it if they were given a discount."
            errors={errors}
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

"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

export type Pricing = { durationMonths: number; registrationFee: string; monthlyFee: string };

/**
 * Sets the fees and duration a skill has at one branch. When adding, they
 * start at the skill's defaults. Where and when it's taught are its class
 * times, set apart.
 */
export function BranchSkillDialog({
  action,
  branches,
  branchName,
  pricing,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  /** Branches that can be picked. Ignored when editing. */
  branches: Option[];
  /** The branch being edited. Left out when adding. */
  branchName?: string;
  /** The branch's own values when editing, the skill's defaults when adding. */
  pricing: Pricing;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={branchName ? `Fees at ${branchName}` : "Add to a branch"}
      description={
        branchName
          ? "A new fee or duration applies to students who join from now on. Current students keep theirs."
          : "The fees and duration start at the skill's defaults. Change them for this branch if it charges differently. Add its class times next."
      }
      trigger={trigger}
      action={action}
      submitLabel={branchName ? "Save" : "Add to branch"}
    >
      {(errors) => (
        <>
          {branchName ? (
            <Field>
              <FieldLabel>Branch</FieldLabel>
              <p className="text-sm">{branchName}</p>
            </Field>
          ) : (
            <SelectField
              label="Branch"
              name="branchId"
              options={branches}
              placeholder="Pick a branch"
              defaultValue=""
              errors={errors.branchId}
            />
          )}
          <TextField
            label="Duration in months"
            name="durationMonths"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            step={1}
            defaultValue={pricing.durationMonths}
            required
            errors={errors.durationMonths}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Registration fee (USD)"
              name="registrationFee"
              inputMode="decimal"
              defaultValue={pricing.registrationFee}
              description="0 if none."
              required
              errors={errors.registrationFee}
            />
            <TextField
              label="Monthly fee (USD)"
              name="monthlyFee"
              inputMode="decimal"
              defaultValue={pricing.monthlyFee}
              required
              errors={errors.monthlyFee}
            />
          </div>
        </>
      )}
    </FormDialog>
  );
}

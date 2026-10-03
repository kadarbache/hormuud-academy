"use client";

import { Fragment, useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { FormDialog } from "@/components/form-dialog";
import { PhoneField, SelectField, TextField, type Option } from "@/components/form-fields";
import type { Currency } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { phoneEntry } from "@/lib/phone";
import { AmountFields } from "../finance/amount-fields";
import { salaryTypeOptions } from "../finance/labels";

function BranchCheckboxes({
  branches,
  checked,
  errors,
}: {
  branches: Option[];
  checked: string[];
  errors?: string[];
}) {
  const id = useId();
  return (
    <FieldSet data-invalid={errors?.length ? true : undefined}>
      <FieldLegend variant="label">Branches they work at</FieldLegend>
      <div className="grid gap-2 sm:grid-cols-2">
        {branches.map((branch) => (
          <Field key={branch.value} orientation="horizontal">
            <Checkbox
              id={`${id}-${branch.value}`}
              name="branchIds"
              value={branch.value}
              defaultChecked={checked.includes(branch.value)}
            />
            <FieldLabel htmlFor={`${id}-${branch.value}`} className="font-normal">
              {branch.label}
            </FieldLabel>
          </Field>
        ))}
      </div>
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </FieldSet>
  );
}

export function TeacherDialog({
  action,
  branches,
  rate,
  teacher,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  branches: Option[];
  /** Shillings to the dollar right now, or null before the admin sets it. */
  rate: string | null;
  teacher?: {
    name: string;
    phone: string | null;
    branchIds: string[];
    salaryType: string;
    fixedSalary: string;
    salaryCurrency: Currency;
    percentageRate: string;
  };
  trigger: React.ReactNode;
}) {
  const [salaryType, setSalaryType] = useState(teacher?.salaryType ?? "FIXED");

  return (
    <FormDialog
      title={teacher ? "Edit teacher" : "Add teacher"}
      trigger={trigger}
      action={action}
      submitLabel={teacher ? "Save" : "Add teacher"}
    >
      {(errors) => (
        <>
          <TextField label="Name" name="name" defaultValue={teacher?.name} required errors={errors.name} />
          <PhoneField
            label="Phone"
            name="phone"
            defaultValue={phoneEntry(teacher?.phone)}
            errors={errors.phone}
          />
          <BranchCheckboxes
            branches={branches}
            checked={teacher?.branchIds ?? []}
            errors={errors.branchIds}
          />
          <SelectField
            label="How they're paid"
            name="salaryType"
            options={salaryTypeOptions}
            value={salaryType}
            onValueChange={setSalaryType}
            errors={errors.salaryType}
          />
          {/* Each box has its own key, so switching how they're paid starts a
              fresh box instead of carrying over what was typed in the other. */}
          {salaryType === "FIXED" ? (
            <Fragment key="fixedSalary">
              <AmountFields
                label="Monthly salary"
                name="fixedSalary"
                currencyName="salaryCurrency"
                rate={rate}
                defaultCurrency={teacher?.salaryCurrency ?? "USD"}
                defaultAmounts={
                  teacher?.fixedSalary
                    ? { [teacher.salaryCurrency]: teacher.fixedSalary }
                    : {}
                }
                placeholders={{ USD: "200", SLSH: "1700000" }}
                description="Paid every month whatever their students pay, in this currency."
                errors={errors}
              />
            </Fragment>
          ) : (
            <TextField
              key="percentageRate"
              label="Percentage of monthly fees"
              name="percentageRate"
              inputMode="decimal"
              defaultValue={teacher?.percentageRate ?? ""}
              placeholder="30"
              description="30 means they earn 30% of every monthly fee their students pay. Changing it only affects what they earn from now on."
              required
              errors={errors.percentageRate}
            />
          )}
        </>
      )}
    </FormDialog>
  );
}

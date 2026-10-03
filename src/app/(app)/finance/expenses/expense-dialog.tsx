"use client";

import { useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { Currency } from "@/generated/prisma/client";
import type { ActionResult, FieldErrors } from "@/lib/action-result";
import { AmountFields } from "../amount-fields";
import { paymentMethodOptions, TEACHER_SALARY_ID } from "../labels";

export type ExpenseDefaults = {
  categoryId: string;
  currency: Currency;
  /** What the amount box starts at in each currency. */
  amounts: Partial<Record<Currency, string>>;
  /** The rate a shilling expense being edited was recorded at, which it keeps. */
  recordedRate?: string | null;
  method: string;
  spentOn: string;
  branchId: string;
  teacherId: string;
  forMonth: string;
  note: string;
};

/** A teacher who can be paid. A fixed salary is paid in its own currency, so that's fixed too. */
export type TeacherOption = Option & { salaryCurrency: Currency | null };

type ExpenseFieldsProps = {
  errors: FieldErrors;
  categories: Option[];
  branches: Option[];
  teachers: TeacherOption[];
  defaults: ExpenseDefaults;
  rate: string | null;
  today: string;
};

/**
 * The fields themselves, inside the form, so every time the dialog opens they
 * start again from the defaults, the category and teacher included.
 */
function ExpenseFields({
  errors,
  categories,
  branches,
  teachers,
  defaults,
  rate,
  today,
}: ExpenseFieldsProps) {
  const [categoryId, setCategoryId] = useState(defaults.categoryId);
  const [teacherId, setTeacherId] = useState(defaults.teacherId);
  const isTeacherPay = categoryId === TEACHER_SALARY_ID;
  const salaryCurrency = isTeacherPay
    ? teachers.find((teacher) => teacher.value === teacherId)?.salaryCurrency
    : null;

  return (
    <>
      <SelectField
        label="Spent on"
        name="categoryId"
        options={categories}
        placeholder="Pick a category"
        value={categoryId}
        onValueChange={setCategoryId}
        errors={errors.categoryId}
      />

      {isTeacherPay && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Teacher"
            name="teacherId"
            options={teachers}
            placeholder="Pick a teacher"
            value={teacherId}
            onValueChange={setTeacherId}
            errors={errors.teacherId}
          />
          <TextField
            label="Month this covers"
            name="forMonth"
            type="month"
            defaultValue={defaults.forMonth}
            required
            errors={errors.forMonth}
          />
        </div>
      )}

      <AmountFields
        label="Amount"
        rate={rate}
        recordedRate={defaults.recordedRate}
        defaultCurrency={defaults.currency}
        defaultAmounts={defaults.amounts}
        lockedCurrency={salaryCurrency ?? undefined}
        placeholders={{ USD: "300", SLSH: "2500000" }}
        description={
          salaryCurrency ? `Their salary is in ${salaryCurrency}, so it's paid in it.` : undefined
        }
        errors={errors}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Paid by"
          name="method"
          options={paymentMethodOptions}
          placeholder="Pick one"
          defaultValue={defaults.method}
          errors={errors.method}
        />
        <TextField
          label="Paid on"
          name="spentOn"
          type="date"
          max={today}
          defaultValue={defaults.spentOn}
          required
          errors={errors.spentOn}
        />
      </div>

      <SelectField
        label="Branch"
        name="branchId"
        options={branches}
        placeholder="Pick a branch"
        defaultValue={defaults.branchId}
        description="The branch this money was spent for."
        errors={errors.branchId}
      />

      <TextField
        label="Note"
        name="note"
        defaultValue={defaults.note}
        placeholder="September rent"
        errors={errors.note}
      />
    </>
  );
}

/**
 * One expense. Teacher salaries name the teacher and the month they cover,
 * so a teacher's pay can always be traced back to them; every other category
 * leaves both out. The Teacher pay screen opens this same dialog with those
 * fields already filled in.
 */
export function ExpenseDialog({
  action,
  title,
  description,
  submitLabel,
  trigger,
  ...fields
}: Omit<ExpenseFieldsProps, "errors"> & {
  action: (formData: FormData) => Promise<ActionResult>;
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={title}
      description={description}
      trigger={trigger}
      action={action}
      submitLabel={submitLabel}
    >
      {(errors) => <ExpenseFields errors={errors} {...fields} />}
    </FormDialog>
  );
}

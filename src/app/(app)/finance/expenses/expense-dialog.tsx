"use client";

import { useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { paymentMethodOptions, TEACHER_SALARY_ID } from "../labels";

export type ExpenseDefaults = {
  categoryId: string;
  amount: string;
  method: string;
  spentOn: string;
  branchId: string;
  teacherId: string;
  forMonth: string;
  note: string;
};

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
  categories,
  branches,
  teachers,
  defaults,
  today,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  categories: Option[];
  branches: Option[];
  teachers: Option[];
  defaults: ExpenseDefaults;
  today: string;
  trigger: React.ReactNode;
}) {
  const [categoryId, setCategoryId] = useState(defaults.categoryId);
  const isTeacherPay = categoryId === TEACHER_SALARY_ID;

  return (
    <FormDialog
      title={title}
      description={description}
      trigger={trigger}
      action={action}
      submitLabel={submitLabel}
    >
      {(errors) => (
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
                defaultValue={defaults.teacherId}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Amount (USD)"
              name="amount"
              inputMode="decimal"
              defaultValue={defaults.amount}
              placeholder="300"
              required
              errors={errors.amount}
            />
            <SelectField
              label="Paid by"
              name="method"
              options={paymentMethodOptions}
              placeholder="Pick one"
              defaultValue={defaults.method}
              errors={errors.method}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Paid on"
              name="spentOn"
              type="date"
              max={today}
              defaultValue={defaults.spentOn}
              required
              errors={errors.spentOn}
            />
            <SelectField
              label="Branch"
              name="branchId"
              options={branches}
              placeholder="Pick a branch"
              defaultValue={defaults.branchId}
              description="The branch this money was spent for."
              errors={errors.branchId}
            />
          </div>

          <TextField
            label="Note"
            name="note"
            defaultValue={defaults.note}
            placeholder="September rent"
            errors={errors.note}
          />
        </>
      )}
    </FormDialog>
  );
}

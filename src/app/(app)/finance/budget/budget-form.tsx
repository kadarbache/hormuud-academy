"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FormError, TextField } from "@/components/form-fields";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/action-result";
import { expenseCategories, expenseCategoryLabels, lineField } from "../labels";

/**
 * One branch's plan for one month: the income it expects and what it means to
 * spend on each thing. A box left empty means nothing was planned for that
 * category, which the comparison shows as unplanned spending if money goes
 * out on it anyway.
 */
export function BudgetForm({
  action,
  month,
  branchName,
  defaults,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  month: string;
  branchName: string;
  defaults: { expectedIncome: string; note: string; lines: Record<string, string> };
}) {
  const { pending, fieldErrors, formError, onSubmit } = useFormAction(action);

  return (
    <Card>
      <CardHeader>
        <CardTitle>The plan for {branchName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <input type="hidden" name="month" value={month} />
          <FieldGroup>
            <TextField
              label="Income you expect (USD)"
              name="expectedIncome"
              inputMode="decimal"
              defaultValue={defaults.expectedIncome}
              placeholder="3000"
              required
              errors={fieldErrors.expectedIncome}
            />

            <FieldSet>
              <FieldLegend variant="label">What you plan to spend</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {expenseCategories.map((category) => (
                  <TextField
                    key={category}
                    label={expenseCategoryLabels[category]}
                    name={lineField(category)}
                    inputMode="decimal"
                    defaultValue={defaults.lines[category] ?? ""}
                    placeholder="0"
                    errors={fieldErrors[lineField(category)]}
                  />
                ))}
              </div>
            </FieldSet>

            <TextField
              label="Note"
              name="note"
              defaultValue={defaults.note}
              placeholder="Rent goes up from the 15th"
              errors={fieldErrors.note}
            />

            <FormError message={formError} />
          </FieldGroup>

          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              Save the plan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

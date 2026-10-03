"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormError, TextField } from "@/components/form-fields";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/action-result";

/** The box the admin types a new exchange rate into. */
export function RateForm({
  action,
  current,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  /** The rate in force, like "8550", or empty before there is one. */
  current: string;
}) {
  const { pending, fieldErrors, formError, onSubmit } = useFormAction(action);

  return (
    // Keyed on the rate in force, so the box shows the new rate once it's saved.
    <form key={current} onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <TextField
            label="Shillings to one dollar"
            name="rate"
            inputMode="decimal"
            defaultValue={current}
            placeholder="8550"
            required
            errors={fieldErrors.rate}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          Save the rate
        </Button>
      </div>
      <FormError message={formError} />
    </form>
  );
}

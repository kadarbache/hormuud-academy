"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult, FieldErrors } from "@/lib/action-result";

type Success<T> = Extract<ActionResult<T>, { ok: true }>;

/**
 * Runs a server action from a form's onSubmit.
 *
 * A plain `<form action={...}>` resets every field once the action finishes,
 * so a validation error would wipe what the user typed. Submitting through
 * onSubmit keeps the values, shows the field errors, and toasts the action's
 * success message.
 */
export function useFormAction<T>(
  action: (formData: FormData) => Promise<ActionResult<T>>,
  options: { onSuccess?: (result: Success<T>) => void } = {},
) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setFieldErrors({});
        setFormError(null);
        if (result.message) toast.success(result.message);
        options.onSuccess?.(result);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.error);
      }
    });
  }

  function clearErrors() {
    setFieldErrors({});
    setFormError(null);
  }

  return { pending, fieldErrors, formError, onSubmit, clearErrors };
}

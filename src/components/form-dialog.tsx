"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FormError } from "@/components/form-fields";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult, FieldErrors } from "@/lib/action-result";

/**
 * A dialog holding one form that runs one server action. The dialog closes
 * when the action succeeds and stays open, with the errors shown, when it
 * doesn't. `children` receives the field errors to hand to each field.
 */
export function FormDialog<T>({
  title,
  description,
  trigger,
  action,
  submitLabel = "Save",
  onSuccess,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  trigger: React.ReactNode;
  action: (formData: FormData) => Promise<ActionResult<T>>;
  submitLabel?: string;
  onSuccess?: () => void;
  children: (fieldErrors: FieldErrors) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Bumped on every open so the form below remounts empty (or with the
  // record's current values) instead of keeping what was typed last time.
  const [openCount, setOpenCount] = useState(0);
  const { pending, fieldErrors, formError, onSubmit, clearErrors } = useFormAction(action, {
    onSuccess: () => {
      setOpen(false);
      onSuccess?.();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setOpenCount((count) => count + 1);
        else clearErrors();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form key={openCount} onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {children(fieldErrors)}
            <FormError message={formError} />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

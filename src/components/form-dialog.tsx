"use client";

import { use, useState } from "react";
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

/** What React hands us instead of an element while its chunk is still in flight. */
type LazyNode = { $$typeof: symbol; _payload: Promise<React.ReactNode> };

function isLazyNode(node: React.ReactNode): node is React.ReactNode & LazyNode {
  return (
    typeof node === "object" &&
    node !== null &&
    "$$typeof" in node &&
    node.$$typeof === Symbol.for("react.lazy") &&
    "_payload" in node
  );
}

/**
 * The button that opens the dialog, ready for Radix to slot the dialog's own
 * props onto.
 *
 * A page is a server component, so the button it passes as `trigger` reaches
 * the browser in the streamed payload, and anything still in flight arrives as
 * a lazy node — sometimes a lazy node wrapped in another one, which is what
 * happens to the later rows of a long table on the first visit. Radix unwraps
 * one layer and then refuses to slot onto what's left ("Primitive.button
 * failed to slot onto its children"), taking the whole screen down with it, so
 * unwrap to the real element first. `use` is allowed in a loop and waits for a
 * chunk that hasn't landed yet.
 */
function useTriggerElement(trigger: React.ReactNode) {
  let resolved = trigger;
  // Nothing sane nests this deep; the limit only stops a broken chunk looping.
  for (let depth = 0; depth < 10 && isLazyNode(resolved); depth++) {
    resolved = use(resolved._payload);
  }
  return resolved;
}

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
  const triggerElement = useTriggerElement(trigger);
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
      <DialogTrigger asChild>{triggerElement}</DialogTrigger>
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

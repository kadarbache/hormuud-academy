"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/action-result";

type Confirm = {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
};

/**
 * A button that runs a server action with no form, like Deactivate or Mark
 * finished. Pass `confirm` to ask first, and `redirectTo` to leave the page
 * once it worked (after deleting the record the page shows, for example).
 */
export function ActionButton({
  action,
  confirm,
  redirectTo,
  children,
  disabled,
  ...button
}: {
  action: () => Promise<ActionResult<unknown>>;
  confirm?: Confirm;
  redirectTo?: string;
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "action">) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function run() {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) toast.success(result.message);
        setOpen(false);
        if (redirectTo) router.push(redirectTo);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!confirm) {
    return (
      <Button {...button} disabled={disabled || pending} onClick={run}>
        {pending && <Spinner />}
        {children}
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button {...button} disabled={disabled}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant={confirm.destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={run}
          >
            {pending && <Spinner />}
            {confirm.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
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

/**
 * Hands out a temporary password: a student's login on their page, a
 * teacher's on Staff accounts. Asks first, then shows the password once, for
 * staff to read out or write down. Closing the dialog is the last anyone sees
 * of it: only its hash is kept.
 */
export function IssuePasswordButton({
  action,
  who,
  loginId,
  expiresNote,
  label,
  title,
  description,
  confirmLabel,
  variant = "default",
}: {
  action: () => Promise<ActionResult<{ password: string }>>;
  who: "student" | "teacher";
  /** What they sign in with: STU-00042 or TCH-00007. */
  loginId: string;
  /** How long the password works, when it doesn't forever. */
  expiresNote?: string;
  label: string;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      const result = await action();
      if (result.ok && result.data) {
        setPassword(result.data.password);
      } else if (!result.ok) {
        toast.error(result.error);
        setOpen(false);
      }
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && password) {
      // Forget the password, and only now show the page as it is since: the
      // action doesn't refresh it, or this button could vanish mid-read.
      setPassword(null);
      router.refresh();
    }
  }

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied.");
    } catch {
      toast.error("Couldn't copy. Write it down instead.");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm">
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {password ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Give the {who} this password</AlertDialogTitle>
              <AlertDialogDescription>
                It won&apos;t be shown again. They sign in with{" "}
                <span className="font-mono text-foreground">{loginId}</span> and this password,
                then choose their own.{expiresNote && ` ${expiresNote}`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-3">
              <span className="font-mono text-2xl tracking-widest select-all">{password}</span>
              <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy the password">
                <Copy />
              </Button>
            </div>
            <AlertDialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <Button disabled={pending} onClick={run}>
                {pending && <Spinner />}
                {confirmLabel}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

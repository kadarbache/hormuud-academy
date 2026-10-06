"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FormError, PasswordField } from "@/components/form-fields";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/action-result";

/**
 * Choosing your own password: a student in the portal, or a teacher. On a
 * temporary password the current one isn't asked for, since they just signed
 * in with it. Saving goes on to `home`.
 */
export function PasswordForm({
  action,
  askCurrent,
  minLength,
  home,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  askCurrent: boolean;
  minLength: number;
  home: string;
}) {
  const router = useRouter();
  const { pending, fieldErrors, formError, onSubmit } = useFormAction(action, {
    onSuccess: () => {
      router.replace(home);
      router.refresh();
    },
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {askCurrent && (
          <PasswordField
            label="Current password"
            name="currentPassword"
            autoComplete="current-password"
            required
            errors={fieldErrors.currentPassword}
          />
        )}
        <PasswordField
          label="New password"
          name="newPassword"
          autoComplete="new-password"
          description={`At least ${minLength} characters.`}
          required
          errors={fieldErrors.newPassword}
        />
        <PasswordField
          label="New password again"
          name="confirmPassword"
          autoComplete="new-password"
          required
          errors={fieldErrors.confirmPassword}
        />
        <FormError message={formError} />
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Spinner />}
          Save password
        </Button>
      </FieldGroup>
    </form>
  );
}

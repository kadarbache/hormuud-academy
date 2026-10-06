"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FormError, PasswordField } from "@/components/form-fields";
import { useFormAction } from "@/hooks/use-form-action";
import { changePassword } from "./actions";

export function PasswordForm({ askCurrent }: { askCurrent: boolean }) {
  const router = useRouter();
  const { pending, fieldErrors, formError, onSubmit } = useFormAction(changePassword, {
    onSuccess: () => {
      router.replace("/portal");
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
          description="At least 8 characters."
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

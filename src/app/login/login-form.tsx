"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FormError, PasswordField, TextField } from "@/components/form-fields";
import { useFormAction } from "@/hooks/use-form-action";
import { signIn } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const { pending, fieldErrors, formError, onSubmit } = useFormAction(signIn, {
    onSuccess: () => {
      // The home page sends staff to Students, a teacher to Attendance and a
      // student to the portal.
      router.replace("/");
      router.refresh();
    },
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField
          label="Email, Student ID or Teacher ID"
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          errors={fieldErrors.login}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          errors={fieldErrors.password}
        />
        <FormError message={formError} />
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Spinner />}
          Log in
        </Button>
      </FieldGroup>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FormError, TextField } from "@/components/form-fields";
import { useFormAction } from "@/hooks/use-form-action";
import { signIn } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const { pending, fieldErrors, formError, onSubmit } = useFormAction(signIn, {
    onSuccess: () => {
      router.replace("/students");
      router.refresh();
    },
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          errors={fieldErrors.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
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

"use client";

import { useId } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectInput, type Option } from "@/components/select-input";

type BaseProps = {
  label: string;
  name: string;
  errors?: string[];
  description?: React.ReactNode;
};

function toFieldErrors(errors?: string[]) {
  return errors?.map((message) => ({ message }));
}

export function TextField({
  label,
  name,
  errors,
  description,
  ...input
}: BaseProps & Omit<React.ComponentProps<typeof Input>, "name" | "id">) {
  const id = useId();
  const invalid = Boolean(errors?.length);

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={name} aria-invalid={invalid || undefined} {...input} />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={toFieldErrors(errors)} />
    </Field>
  );
}

export type { Option };

export function SelectField({
  label,
  name,
  errors,
  description,
  options,
  placeholder,
  ...select
}: BaseProps &
  Omit<React.ComponentProps<typeof SelectInput>, "name" | "id" | "aria-invalid">) {
  const id = useId();
  const invalid = Boolean(errors?.length);

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <SelectInput
        id={id}
        name={name}
        options={options}
        placeholder={placeholder}
        className="w-full"
        aria-invalid={invalid || undefined}
        {...select}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={toFieldErrors(errors)} />
    </Field>
  );
}

/** The error that isn't tied to one field, shown above the form's buttons. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

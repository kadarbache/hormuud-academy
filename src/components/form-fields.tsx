"use client";

import { useId } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

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

export type Option = { value: string; label: string };

export function SelectField({
  label,
  name,
  errors,
  description,
  options,
  placeholder,
  ...select
}: BaseProps & {
  options: Option[];
  /** Shown as an empty first choice, so nothing is picked by accident. */
  placeholder?: string;
} & Omit<React.ComponentProps<typeof NativeSelect>, "name" | "id">) {
  const id = useId();
  const invalid = Boolean(errors?.length);

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        name={name}
        className="w-full"
        aria-invalid={invalid || undefined}
        {...select}
      >
        {placeholder !== undefined && (
          <NativeSelectOption value="">{placeholder}</NativeSelectOption>
        )}
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
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

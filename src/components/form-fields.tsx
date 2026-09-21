"use client";

import { useId, useState } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectInput, type Option } from "@/components/select-input";
import { DEFAULT_PREFIX, NATIONAL_DIGITS, PHONE_PREFIX, phoneTyped } from "@/lib/phone";

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

/**
 * A phone number. Every number here is a Somali mobile, so the country code
 * sits in a box of its own and only the nine digits are typed, grouped the
 * way they're read out: 61 1111111. The box starts at 6 because most numbers
 * do, and that digit can be typed over like any other.
 */
export function PhoneField({
  label,
  name,
  errors,
  description,
  defaultValue,
  onChange,
  ...input
}: BaseProps & Omit<React.ComponentProps<typeof Input>, "name" | "id" | "type" | "value">) {
  const id = useId();
  const invalid = Boolean(errors?.length);
  const [value, setValue] = useState(
    () => phoneTyped(String(defaultValue ?? "")) || DEFAULT_PREFIX,
  );

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-stretch">
        <span className="inline-flex h-9 shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-sm whitespace-nowrap text-muted-foreground select-none">
          {PHONE_PREFIX}
        </span>
        <Input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          // The nine digits plus the space between the two groups.
          maxLength={NATIONAL_DIGITS + 1}
          placeholder="61 1111111"
          aria-invalid={invalid || undefined}
          className="rounded-l-none font-mono tracking-wide"
          value={value}
          onChange={(event) => {
            setValue(phoneTyped(event.target.value));
            onChange?.(event);
          }}
          {...input}
        />
      </div>
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

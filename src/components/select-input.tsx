"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Option = {
  value: string;
  label: string;
  /** Shown before the label, in the list and in the box once picked. */
  icon?: React.ReactNode;
};

type SelectInputProps = Omit<React.ComponentProps<typeof Select>, "children"> &
  Pick<
    React.ComponentProps<typeof SelectTrigger>,
    "id" | "className" | "size" | "aria-label" | "aria-invalid"
  > & {
    options: Option[];
    /** Shown in the box while nothing is picked, so nothing is chosen by accident. */
    placeholder?: string;
  };

/**
 * The one dropdown every screen uses. The list is drawn by the page, so it
 * gets the app's font and theme, which the browser's own `<select>` list
 * can't. `className` sizes the box you click. `name` puts the choice in the
 * form, and Radix won't take an empty option value, so a "no filter" choice
 * needs a real value of its own.
 */
export function SelectInput({
  options,
  placeholder,
  id,
  className,
  size,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  ...select
}: SelectInputProps) {
  return (
    <Select {...select}>
      <SelectTrigger
        id={id}
        size={size}
        className={className}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.icon}
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

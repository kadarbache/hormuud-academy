"use client";

import { useState } from "react";
import { SelectField, TextField } from "@/components/form-fields";
import type { Currency } from "@/generated/prisma/client";
import type { FieldErrors } from "@/lib/action-result";
import { formatMoney, formatRate } from "@/lib/format";
import { shillingsToDollars } from "@/lib/money";
import { currencyOptions } from "./labels";

/**
 * What a shilling amount comes to in dollars, or why it can't be recorded.
 * An amount being corrected keeps the rate it was first recorded at, so
 * that's the rate it's shown at.
 */
function ShillingNote({
  amount,
  rate,
  recordedRate,
}: {
  amount: string;
  rate: string | null;
  recordedRate?: string | null;
}) {
  const shownRate = recordedRate ?? rate;
  if (!shownRate) {
    return (
      <p className="text-sm text-destructive">
        There&apos;s no exchange rate yet, so shillings can&apos;t be recorded. The admin sets it
        under Settings.
      </p>
    );
  }
  const shillings = amount.replace(/[\s,]/g, "");
  const worth =
    /^\d{1,12}$/.test(shillings) && Number(shillings) > 0
      ? `About ${formatMoney(shillingsToDollars(shillings, shownRate))} at `
      : "At ";
  return (
    <p className="text-sm text-muted-foreground">
      {worth}
      {recordedRate
        ? `the rate it was recorded at, ${formatRate(recordedRate)} shillings to the dollar.`
        : `today's rate of ${formatRate(shownRate)} shillings to the dollar.`}
    </p>
  );
}

/**
 * The currency picker on its own, for money whose amount is already known,
 * like a registration fee. `children` gets the picked currency, to say what
 * that comes to.
 */
export function CurrencyField({
  label = "Paid in",
  name = "currency",
  rate,
  defaultCurrency = "USD",
  errors,
  children,
}: {
  label?: string;
  name?: string;
  rate: string | null;
  defaultCurrency?: Currency;
  errors?: string[];
  children?: (currency: Currency) => React.ReactNode;
}) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);

  return (
    <>
      <SelectField
        label={label}
        name={name}
        options={currencyOptions}
        value={currency}
        onValueChange={(value) => setCurrency(value as Currency)}
        errors={errors}
      />
      {children?.(currency)}
      {currency === "SLSH" && !rate && !errors?.length && <ShillingNote amount="" rate={null} />}
    </>
  );
}

/**
 * An amount and the currency it's in, side by side. Dollars take cents;
 * shillings are whole. A shilling amount shows what it comes to in dollars
 * at the rate in force, which is the rate it will keep once recorded.
 *
 * `defaultAmounts` is what the box starts at in each currency: a monthly fee
 * starts at the fee in dollars, and at the fee in shillings once shillings
 * are picked. Switching currency swaps the box to that currency's amount
 * until something is typed in it; after that, what was typed stays.
 */
export function AmountFields({
  label,
  name = "amount",
  currencyName = "currency",
  rate,
  recordedRate,
  defaultCurrency = "USD",
  defaultAmounts = {},
  lockedCurrency,
  placeholders = { USD: "30", SLSH: "250000" },
  description,
  errors,
}: {
  label: string;
  name?: string;
  currencyName?: string;
  rate: string | null;
  /**
   * The rate a shilling amount being corrected was recorded at. It keeps that
   * rate while it stays in shillings, so the note shows it instead of today's.
   */
  recordedRate?: string | null;
  defaultCurrency?: Currency;
  defaultAmounts?: Partial<Record<Currency, string>>;
  /** Fixes the currency, like a fixed salary's: the picker shows it and can't change it. */
  lockedCurrency?: Currency;
  placeholders?: Record<Currency, string>;
  description?: React.ReactNode;
  errors: FieldErrors;
}) {
  const [picked, setPicked] = useState<Currency>(defaultCurrency);
  const [amount, setAmount] = useState(defaultAmounts[defaultCurrency] ?? "");
  const [typed, setTyped] = useState(false);
  const currency = lockedCurrency ?? picked;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={label}
          name={name}
          inputMode={currency === "SLSH" ? "numeric" : "decimal"}
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setTyped(true);
          }}
          placeholder={placeholders[currency]}
          description={description}
          required
          errors={errors[name]}
        />
        <SelectField
          label="Currency"
          name={currencyName}
          options={currencyOptions}
          value={currency}
          disabled={Boolean(lockedCurrency)}
          onValueChange={(value) => {
            const next = value as Currency;
            setPicked(next);
            if (!typed) setAmount(defaultAmounts[next] ?? "");
          }}
          errors={errors[currencyName]}
        />
        {/* A disabled picker sends nothing, so a fixed currency rides along here. */}
        {lockedCurrency && <input type="hidden" name={currencyName} value={lockedCurrency} />}
      </div>
      {/* Once the server has said why shillings can't be taken, that says it. */}
      {currency === "SLSH" && (rate || recordedRate || !errors[currencyName]) && (
        <ShillingNote amount={amount} rate={rate} recordedRate={recordedRate} />
      )}
    </>
  );
}

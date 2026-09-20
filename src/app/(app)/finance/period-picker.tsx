"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectInput } from "@/components/select-input";
import type { Period } from "./period";

const kindOptions = [
  { value: "day", label: "One day" },
  { value: "month", label: "One month" },
  { value: "all", label: "Everything" },
];

/**
 * The "when" on a financial screen: one day at the counter, one month of the
 * books, or the lot. Only the input that matters is shown, and the other
 * value still goes with the form so switching back keeps what was picked.
 */
export function PeriodPicker({ period }: { period: Period }) {
  const [kind, setKind] = useState(period.kind);

  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="period">Show</Label>
        <SelectInput
          id="period"
          name="period"
          options={kindOptions}
          value={kind}
          onValueChange={(value) => setKind(value as Period["kind"])}
          className="w-40"
        />
      </div>

      {kind === "day" && (
        <div className="grid gap-1.5">
          <Label htmlFor="day">Day</Label>
          <Input id="day" name="day" type="date" defaultValue={period.day} className="w-44" />
        </div>
      )}
      {kind !== "day" && <input type="hidden" name="day" value={period.day} />}

      {kind === "month" && (
        <div className="grid gap-1.5">
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            name="month"
            type="month"
            defaultValue={period.month}
            className="w-44"
          />
        </div>
      )}
      {kind !== "month" && <input type="hidden" name="month" value={period.month} />}
    </>
  );
}

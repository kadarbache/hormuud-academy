"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import { SelectInput } from "@/components/select-input";
import type { ActionResult, FieldErrors } from "@/lib/action-result";
import { formatMoney } from "@/lib/format";
import { dollarsToShillings, fromCents, toCents } from "@/lib/money";
import { StudentPicker } from "../../students/student-picker";
import { AmountFields } from "../amount-fields";
import { paymentMethodOptions } from "../labels";
import { bookField, LINE_FIELD, quantityField } from "./book-sale-fields";

/** A book a branch can sell now: its price there and the copies on its shelf. */
export type SellableBook = {
  /** The branch book's id. */
  id: string;
  branchId: string;
  title: string;
  /** In dollars, like "5.00". */
  price: string;
  stock: number;
};

type Line = { key: number; bookId: string; quantity: string };

const firstLine: Line = { key: 0, bookId: "", quantity: "1" };

function toErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

/** What the picked books come to in dollars, in cents. Rows not filled in yet count for nothing. */
function totalCents(lines: Line[], books: SellableBook[]) {
  let cents = 0;
  for (const line of lines) {
    const book = books.find((candidate) => candidate.id === line.bookId);
    const quantity = Number(line.quantity);
    if (book && Number.isInteger(quantity) && quantity > 0) cents += toCents(book.price) * quantity;
  }
  return cents;
}

function SaleFields({
  branches,
  books,
  rate,
  today,
  student,
  errors,
}: {
  branches: Option[];
  books: SellableBook[];
  rate: string | null;
  today: string;
  student?: { number: string; name: string };
  errors: FieldErrors;
}) {
  const onlyBranch = branches.length === 1 ? branches[0].value : null;
  const [branchId, setBranchId] = useState(onlyBranch ?? "");
  const [lines, setLines] = useState<Line[]>([firstLine]);
  const [nextKey, setNextKey] = useState(1);

  const onShelf = books.filter((book) => book.branchId === branchId);
  const total = totalCents(lines, onShelf);
  const dollars = fromCents(total);
  const unpicked = onShelf.filter((book) => !lines.some((line) => line.bookId === book.id));

  function change(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <>
      {onlyBranch ? (
        <input type="hidden" name="branchId" value={onlyBranch} />
      ) : (
        <SelectField
          label="Branch"
          name="branchId"
          options={branches}
          placeholder="Pick the branch selling them"
          value={branchId}
          onValueChange={(value) => {
            // Every branch has its own books, so start the rows again.
            setBranchId(value);
            setLines([firstLine]);
          }}
          errors={errors.branchId}
        />
      )}

      <Field data-invalid={errors.lines?.length ? true : undefined}>
        <FieldLabel>Books</FieldLabel>
        <div className="space-y-2">
          {lines.map((line) => {
            const picked = onShelf.find((book) => book.id === line.bookId);
            const options = onShelf
              .filter((book) => book.id === line.bookId || unpicked.includes(book))
              .map((book) => ({
                value: book.id,
                label: `${book.title} · ${formatMoney(book.price)} · ${book.stock} left`,
              }));
            const bookErrors = errors[bookField(line.key)];
            const quantityErrors = errors[quantityField(line.key)];
            return (
              <div key={line.key} className="space-y-1">
                <input type="hidden" name={LINE_FIELD} value={line.key} />
                <div className="flex items-start gap-2">
                  <SelectInput
                    name={bookField(line.key)}
                    options={options}
                    placeholder={branchId ? "Pick a book" : "Pick the branch first"}
                    disabled={!branchId}
                    value={line.bookId}
                    onValueChange={(value) => change(line.key, { bookId: value })}
                    className="min-w-0 flex-1"
                    aria-label="Book"
                    aria-invalid={bookErrors?.length ? true : undefined}
                  />
                  <Input
                    name={quantityField(line.key)}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={picked?.stock}
                    step={1}
                    value={line.quantity}
                    onChange={(event) => change(line.key, { quantity: event.target.value })}
                    className="w-20"
                    aria-label="Copies"
                    aria-invalid={quantityErrors?.length ? true : undefined}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove this book"
                    disabled={lines.length === 1}
                    onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}
                  >
                    <X />
                  </Button>
                </div>
                <FieldError errors={toErrors(bookErrors)} />
                <FieldError errors={toErrors(quantityErrors)} />
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!branchId || unpicked.length === 0 || lines.some((line) => !line.bookId)}
            onClick={() => {
              setLines((current) => [...current, { key: nextKey, bookId: "", quantity: "1" }]);
              setNextKey((key) => key + 1);
            }}
          >
            <Plus />
            Add another book
          </Button>
          {total > 0 && (
            <span className="text-sm">
              Comes to <span className="font-medium tabular-nums">{formatMoney(dollars)}</span>
            </span>
          )}
        </div>
        {branchId && onShelf.length === 0 && (
          <FieldDescription>
            This branch has no books with copies on the shelf. Add copies on the Books page first.
          </FieldDescription>
        )}
        <FieldError errors={toErrors(errors.lines)} />
      </Field>

      <AmountFields
        label="Amount paid"
        rate={rate}
        defaultAmounts={
          total > 0
            ? { USD: dollars, SLSH: rate ? dollarsToShillings(dollars, rate) : "" }
            : {}
        }
        placeholders={{ USD: "0.00", SLSH: "0" }}
        description="What the books come to. Lower it if the student was given a discount."
        errors={errors}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Paid by"
          name="method"
          options={paymentMethodOptions}
          placeholder="Pick one"
          errors={errors.method}
        />
        <TextField
          label="Received on"
          name="paidOn"
          type="date"
          max={today}
          defaultValue={today}
          required
          errors={errors.paidOn}
        />
      </div>
      {student ? (
        <>
          <input type="hidden" name="student" value={student.number} />
          <Field>
            <FieldLabel>Student</FieldLabel>
            <p className="text-sm">
              {student.name} <span className="font-mono text-muted-foreground">{student.number}</span>
            </p>
          </Field>
        </>
      ) : (
        <StudentPicker
          description="Optional. Pick the student to show this sale on their record."
          errors={errors.student}
        />
      )}
      <TextField label="Note" name="note" placeholder="Optional" errors={errors.note} />
    </>
  );
}

/**
 * Sells books over the counter: one or more titles, each with how many
 * copies, on one receipt. Only books with copies on the branch's shelf are
 * offered, and the copies come off the shelf as the sale is recorded. The
 * amount starts at what the books come to, at the branch's prices, and can
 * be lowered for a discount, never raised.
 */
export function SellBooksDialog({
  action,
  branches,
  books,
  rate,
  today,
  student,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  /** The branches this user may sell at. One means no picker. */
  branches: Option[];
  books: SellableBook[];
  /** Shillings to the dollar right now, or null before the admin sets it. */
  rate: string | null;
  today: string;
  /** The student buying, when sold from their own page. */
  student?: { number: string; name: string };
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title="Sell books"
      description="Pick each book and how many copies. Only books with copies on the shelf are listed."
      trigger={trigger}
      action={action}
      submitLabel="Record sale"
    >
      {(errors) => (
        <SaleFields
          branches={branches}
          books={books}
          rate={rate}
          today={today}
          student={student}
          errors={errors}
        />
      )}
    </FormDialog>
  );
}

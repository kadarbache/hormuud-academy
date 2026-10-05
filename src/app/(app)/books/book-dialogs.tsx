"use client";

import { useRouter } from "next/navigation";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { copies } from "./labels";

/** Adds a book to the list, or changes its title and default price. */
export function BookDialog({
  action,
  book,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  book?: { title: string; price: string };
  trigger: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <FormDialog
      title={book ? "Edit book" : "Add book"}
      description={
        book
          ? "The price is a default for branches you add from now on. Branches that sell it already keep their own."
          : "The book is on one list for every branch. The price is a default: each branch can change it when you add the book to it."
      }
      trigger={trigger}
      action={async (formData) => {
        const result = await action(formData);
        // After adding, go straight to the page where branches are set up.
        if (result.ok && result.data) router.push(`/books/${result.data.id}`);
        return result;
      }}
      submitLabel={book ? "Save" : "Add book"}
    >
      {(errors) => (
        <>
          <TextField
            label="Title"
            name="title"
            defaultValue={book?.title}
            placeholder="English Grammar Book 1"
            required
            errors={errors.title}
          />
          <TextField
            label="Default price (USD)"
            name="price"
            inputMode="decimal"
            placeholder="5.00"
            defaultValue={book?.price ?? ""}
            description="What one copy costs. A student can pay it in shillings at the day's rate."
            required
            errors={errors.price}
          />
        </>
      )}
    </FormDialog>
  );
}

/**
 * Sets what a book costs at one branch. When adding, the price starts at the
 * book's default.
 */
export function BranchBookDialog({
  action,
  branches,
  branchName,
  price,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  /** Branches that can be picked. Ignored when editing. */
  branches: Option[];
  /** The branch being edited. Left out when adding. */
  branchName?: string;
  /** The branch's own price when editing, the book's default when adding. */
  price: string;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={branchName ? `Price at ${branchName}` : "Add to a branch"}
      description={
        branchName
          ? "The new price applies to sales from now on. Past sales keep the price they were sold at."
          : "The price starts at the book's default. Change it if this branch charges differently. Then add the copies it has."
      }
      trigger={trigger}
      action={action}
      submitLabel={branchName ? "Save" : "Add to branch"}
    >
      {(errors) => (
        <>
          {branchName ? (
            <Field>
              <FieldLabel>Branch</FieldLabel>
              <p className="text-sm">{branchName}</p>
            </Field>
          ) : (
            <SelectField
              label="Branch"
              name="branchId"
              options={branches}
              placeholder="Pick a branch"
              defaultValue=""
              errors={errors.branchId}
            />
          )}
          <TextField
            label="Price (USD)"
            name="price"
            inputMode="decimal"
            defaultValue={price}
            required
            errors={errors.price}
          />
        </>
      )}
    </FormDialog>
  );
}

/** Records a delivery: copies that arrived at the branch go on its shelf. */
export function AddCopiesDialog({
  action,
  title,
  branchName,
  stock,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  title: string;
  branchName: string;
  /** Copies on the shelf now. */
  stock: number;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={`Add copies of ${title}`}
      description={`${branchName} has ${copies(stock)} now. Record the copies that arrived, and they're ready to sell.`}
      trigger={trigger}
      action={action}
      submitLabel="Add copies"
    >
      {(errors) => (
        <>
          <TextField
            label="Copies that arrived"
            name="copies"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="20"
            required
            errors={errors.copies}
          />
          <TextField
            label="Note"
            name="note"
            placeholder="From the head office"
            description="Optional."
            errors={errors.note}
          />
        </>
      )}
    </FormDialog>
  );
}

/** Sets the count to what's really on the shelf, with the reason. */
export function FixCountDialog({
  action,
  title,
  branchName,
  stock,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  title: string;
  branchName: string;
  /** Copies on the shelf now, by the app's count. */
  stock: number;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={`Fix the count of ${title}`}
      description={`The app says ${branchName} has ${copies(stock)}. Count the shelf and enter what's really there. For copies that just arrived, use Add copies instead.`}
      trigger={trigger}
      action={action}
      submitLabel="Save count"
    >
      {(errors) => (
        <>
          <TextField
            label="Copies on the shelf"
            name="count"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={stock}
            required
            errors={errors.count}
          />
          <TextField
            label="Why it changed"
            name="note"
            placeholder="Two copies damaged"
            required
            errors={errors.note}
          />
        </>
      )}
    </FormDialog>
  );
}

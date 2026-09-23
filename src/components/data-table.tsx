"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataTableColumn = {
  /** The heading, and the label this column's value gets in the dialog. */
  label: string;
  /** Classes for the body cells, such as `text-right` or a width. */
  className?: string;
  /** Classes for the heading cell. Defaults to the body cell's. */
  headClassName?: string;
  /** Buttons and menus. The heading is hidden and the dialog puts them at the bottom. */
  actions?: boolean;
  /** Leave this column out of the dialog, for something the title already says. */
  hideInDialog?: boolean;
};

export type DataTableRow = {
  /** Stable id for this row. */
  key: string;
  /** The dialog's heading, usually the row's name or number. */
  title: React.ReactNode;
  /** A line under the heading. */
  description?: React.ReactNode;
  /** What to draw in each column, looked up by the column's label. */
  cells: Record<string, React.ReactNode>;
  className?: string;
};

/** Clicks on these do their own thing, so they never open the dialog. */
const INTERACTIVE = "a, button, input, select, textarea, label, [role='menuitem'], [role='checkbox']";

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && target.closest(INTERACTIVE) !== null;
}

/**
 * A table whose rows open a dialog listing every column as a label and a
 * value. A phone shows a few columns at a time and the rest is a sideways
 * scroll away, so tapping a row is the quick way to read all of it. Links and
 * buttons inside a row still do their own job.
 */
export function DataTable({
  columns,
  rows,
  footer,
}: {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  /** A totals row, drawn under the body. */
  footer?: React.ReactNode;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openRow = rows.find((row) => row.key === openKey) ?? null;

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.label} className={column.headClassName ?? column.className}>
                  {column.actions ? <span className="sr-only">{column.label}</span> : column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.key}
                className={`cursor-pointer ${row.className ?? ""}`}
                // The row is a button of its own, on top of the links inside it.
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-label={typeof row.title === "string" ? row.title : undefined}
                onClick={(event) => {
                  // Let a link or a menu handle its own click, and let someone
                  // finish selecting text without a dialog jumping up.
                  if (isInteractive(event.target)) return;
                  if (window.getSelection()?.toString()) return;
                  setOpenKey(row.key);
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setOpenKey(row.key);
                }}
              >
                {columns.map((column) => (
                  <TableCell key={column.label} className={column.className}>
                    {row.cells[column.label]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {footer && <TableFooter>{footer}</TableFooter>}
        </Table>
      </div>

      <Dialog open={openRow !== null} onOpenChange={(open) => !open && setOpenKey(null)}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-md">
          {openRow && (
            <>
              <DialogHeader>
                <DialogTitle>{openRow.title}</DialogTitle>
                {openRow.description ? (
                  <DialogDescription>{openRow.description}</DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">
                    Everything this row holds.
                  </DialogDescription>
                )}
              </DialogHeader>

              <dl className="mt-4 text-sm">
                {columns.map((column) =>
                  column.actions || column.hideInDialog ? null : (
                    <div
                      key={column.label}
                      className="grid grid-cols-[8rem_1fr] items-baseline gap-3 border-b py-2.5 last:border-0"
                    >
                      <dt className="text-muted-foreground">{column.label}</dt>
                      {/* No cell classes here: in a dialog the value reads
                          better left-aligned and wrapped over several lines. */}
                      <dd className="min-w-0">{openRow.cells[column.label]}</dd>
                    </div>
                  ),
                )}
              </dl>

              {columns.some((column) => column.actions) && (
                <DialogFooter className="mt-4 flex-row flex-wrap justify-end gap-1">
                  {columns.map((column) =>
                    column.actions ? (
                      <div key={column.label}>{openRow.cells[column.label]}</div>
                    ) : null,
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

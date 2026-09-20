import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { isNegative } from "./queries";

// The two shapes every financial screen is made of: a row of headline
// amounts, and a table of amounts that add up to a total.

export function StatCard({
  label,
  amount,
  hint,
  tone = "plain",
}: {
  label: string;
  /** An amount like "1234.50". */
  amount: string;
  hint?: React.ReactNode;
  /** "balance" colours the figure red when the college is out of pocket. */
  tone?: "plain" | "muted" | "balance";
}) {
  const negative = tone === "balance" && isNegative(amount);
  return (
    <Card className={tone === "muted" ? "bg-muted/40" : undefined}>
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-2xl font-semibold tabular-nums ${negative ? "text-destructive" : ""}`}
        >
          {formatMoney(amount)}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const columnClasses = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
} as const;

export function StatRow({
  columns = 4,
  children,
}: {
  columns?: keyof typeof columnClasses;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${columnClasses[columns]}`}>{children}</div>
  );
}

/**
 * A category-by-category breakdown. Rows that took or spent nothing are kept,
 * so the same list of categories shows every time and a zero is visibly a
 * zero rather than a missing line.
 */
export function Breakdown({
  heading,
  amountHeading = "Amount",
  rows,
  total,
  totalLabel = "Total",
}: {
  heading: string;
  amountHeading?: string;
  rows: { key: string; label: string; amount: string; hint?: React.ReactNode }[];
  total: string;
  totalLabel?: string;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{heading}</TableHead>
            <TableHead className="text-right">{amountHeading}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <div>{row.label}</div>
                {row.hint && <div className="text-xs text-muted-foreground">{row.hint}</div>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(row.amount)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="font-medium">
            <TableCell>{totalLabel}</TableCell>
            <TableCell
              className={`text-right tabular-nums ${isNegative(total) ? "text-destructive" : ""}`}
            >
              {formatMoney(total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

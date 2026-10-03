import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Currency } from "@/generated/prisma/client";
import { currentRate } from "@/lib/exchange-rate";
import { formatMoney, formatRate } from "@/lib/format";
import { toCents, totalAtRate, type MoneyTotal } from "@/lib/money";
import { isNegative } from "./queries";

// The shapes every financial screen is made of: a row of headline amounts,
// and a table of amounts that add up to a total. The college keeps dollars
// and shillings apart, so every figure shows both, and underneath what the
// two come to together in dollars at today's rate: what the money is worth
// now. The cards and tables read today's rate themselves, so every figure on
// a page uses the same one. A single receipt keeps its own dollar value from
// the day it was taken; that's the Amount below.

const shillingNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function redIf(negative: boolean) {
  return negative ? "text-destructive" : "";
}

/** "At 12,000 shillings to the dollar", for a combined figure's tooltip. */
function rateTitle(rate: string | null) {
  return rate ? `At today's rate, ${formatRate(rate)} shillings to the dollar` : undefined;
}

export async function StatCard({
  label,
  amount,
  hint,
  tone = "plain",
}: {
  label: string;
  /**
   * Money in both currencies, or one dollar amount like "1234.50" for money
   * that's only ever in dollars: fees owed, and the monthly budget.
   */
  amount: MoneyTotal | string;
  hint?: React.ReactNode;
  /** "balance" colours a figure red when the college is out of pocket. */
  tone?: "plain" | "muted" | "balance";
}) {
  const balance = tone === "balance";

  if (typeof amount === "string") {
    return (
      <Card className={tone === "muted" ? "bg-muted/40" : undefined}>
        <CardContent className="space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${redIf(balance && isNegative(amount))}`}
          >
            {formatMoney(amount)}
          </p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    );
  }

  const rate = await currentRate();
  const figure = totalAtRate(amount, rate);

  return (
    <Card className={tone === "muted" ? "bg-muted/40" : undefined}>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="space-y-0.5 text-xl font-semibold tabular-nums">
          <p className={redIf(balance && isNegative(figure.USD))}>{formatMoney(figure.USD)}</p>
          <p className={redIf(balance && isNegative(figure.SLSH))}>
            {shillingNumber.format(Number(figure.SLSH))}{" "}
            <span className="text-xs font-medium text-muted-foreground">SLSH</span>
          </p>
        </div>
        <div
          className="flex flex-wrap items-baseline justify-between gap-x-2 border-t pt-2 text-xs text-muted-foreground"
          title={rateTitle(rate)}
        >
          <span>Combined at today&apos;s rate</span>
          {figure.combined === null ? (
            <span>Set a rate first</span>
          ) : (
            <span
              className={`font-medium tabular-nums ${balance && isNegative(figure.combined) ? "text-destructive" : "text-foreground"}`}
            >
              {formatMoney(figure.combined)}
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// A card shows a figure in both currencies, and five of them side by side
// only have room for big shilling figures on a wide screen.
const columnClasses = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-3 xl:grid-cols-5",
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
 * A category-by-category breakdown, with a column per currency and what the
 * two come to together at today's rate. Rows that took or spent nothing are
 * kept, so the same list of categories shows every time and a zero is
 * visibly a zero rather than a missing line.
 */
export async function Breakdown({
  heading,
  rows,
  total,
  totalLabel = "Total",
}: {
  heading: string;
  rows: { key: string; label: string; amount: MoneyTotal; hint?: React.ReactNode }[];
  total: MoneyTotal;
  totalLabel?: string;
}) {
  const rate = await currentRate();
  const combined = (amount: MoneyTotal) => totalAtRate(amount, rate).combined;
  const totalCombined = combined(total);

  // Four columns are a squeeze on a phone, so the headings and the labels
  // may wrap: the amounts stay on one line each and the table fits the screen.
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-normal">{heading}</TableHead>
            <TableHead className="text-right">USD</TableHead>
            <TableHead className="text-right">SLSH</TableHead>
            <TableHead className="text-right whitespace-normal" title={rateTitle(rate)}>
              Combined at today&apos;s rate
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const rowCombined = combined(row.amount);
            return (
              <TableRow key={row.key}>
                <TableCell className="whitespace-normal">
                  <div>{row.label}</div>
                  {row.hint && (
                    <div className="text-xs whitespace-normal text-muted-foreground">{row.hint}</div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(row.amount.USD)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {shillingNumber.format(Number(row.amount.SLSH))}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {rowCombined === null ? "—" : formatMoney(rowCombined)}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="font-medium">
            <TableCell className="whitespace-normal">{totalLabel}</TableCell>
            <TableCell className={`text-right tabular-nums ${redIf(isNegative(total.USD))}`}>
              {formatMoney(total.USD)}
            </TableCell>
            <TableCell className={`text-right tabular-nums ${redIf(isNegative(total.SLSH))}`}>
              {shillingNumber.format(Number(total.SLSH))}
            </TableCell>
            <TableCell
              className={`text-right tabular-nums ${totalCombined !== null ? redIf(isNegative(totalCombined)) : ""}`}
            >
              {totalCombined === null ? "—" : formatMoney(totalCombined)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * One recorded amount in its own currency, as on its receipt. A shilling
 * amount also shows what it was worth in dollars the day it was recorded, at
 * the rate it keeps. That's history: totals are at today's rate instead.
 */
export function Amount({
  amount,
  currency,
  exchangeRate,
  usdValue,
}: {
  amount: { toString(): string };
  currency: Currency;
  exchangeRate: { toString(): string } | null;
  usdValue: { toString(): string } | null;
}) {
  if (currency === "USD") return <>{formatMoney(amount.toString())}</>;
  return (
    <>
      <div>{formatMoney(amount.toString(), currency)}</div>
      {usdValue && exchangeRate && (
        <div
          className="text-xs whitespace-nowrap text-muted-foreground"
          title={`Worth ${formatMoney(usdValue.toString())} the day it was recorded, at ${formatRate(exchangeRate.toString())} shillings to the dollar`}
        >
          ≈ {formatMoney(usdValue.toString())} at {formatRate(exchangeRate.toString())}
        </div>
      )}
    </>
  );
}

/**
 * Money that may be in either currency or both, one line per currency that
 * has any. Nothing in either shows as $0.00.
 */
export function MoneyLines({ amount }: { amount: Record<Currency, string> }) {
  const lines = (["USD", "SLSH"] as const).filter((currency) => toCents(amount[currency]) !== 0);
  if (lines.length === 0) return <>{formatMoney(0)}</>;
  return (
    <>
      {lines.map((currency) => (
        <div key={currency} className={redIf(isNegative(amount[currency]))}>
          {formatMoney(amount[currency], currency)}
        </div>
      ))}
    </>
  );
}

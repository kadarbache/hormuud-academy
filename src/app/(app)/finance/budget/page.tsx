import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { collegeMonth, formatMonth, isIsoMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { sumMoney } from "@/lib/money";
import { one } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { StatCard, StatRow } from "../figures";
import { expenseCategoryLabels } from "../labels";
import { isNegative } from "../queries";
import { deleteBudget, saveBudget } from "./actions";
import { BudgetForm } from "./budget-form";
import { branchBudget, budgetOverview } from "./queries";

export const metadata: Metadata = { title: "Monthly budget" };

/** The gap between what was planned and what happened, with a word for it. */
function Difference({ amount, overIsBad }: { amount: string; overIsBad: boolean }) {
  const over = Number(amount) > 0;
  if (Number(amount) === 0) return <span className="text-muted-foreground">On plan</span>;
  const bad = over === overIsBad;
  return (
    <span className={bad ? "text-destructive" : undefined}>
      {over ? "+" : "−"}
      {formatMoney(Math.abs(Number(amount)))}
    </span>
  );
}

function MonthPicker({ month, branchId }: { month: string; branchId: string }) {
  return (
    <Form action="/finance/budget" className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="month">Month</Label>
        <Input id="month" name="month" type="month" defaultValue={month} className="w-44" />
      </div>
      {branchId && <input type="hidden" name="branch" value={branchId} />}
      <Button type="submit" variant="secondary">
        Show
      </Button>
    </Form>
  );
}

export default async function BudgetPage({ searchParams }: PageProps<"/finance/budget">) {
  await requireAdmin();
  const params = await searchParams;
  const requested = one(params, "month");
  const month = isIsoMonth(requested) ? requested : collegeMonth();
  const branchId = one(params, "branch");

  if (!branchId) {
    const branches = await budgetOverview(month);
    const totals = {
      expectedIncome: sumMoney(branches.map((b) => b.expectedIncome)),
      actualIncome: sumMoney(branches.map((b) => b.actualIncome)),
      plannedExpenses: sumMoney(branches.map((b) => b.plannedExpenses)),
      actualExpenses: sumMoney(branches.map((b) => b.actualExpenses)),
      plannedNet: sumMoney(branches.map((b) => b.plannedNet)),
      actualNet: sumMoney(branches.map((b) => b.actualNet)),
    };

    return (
      <>
        <PageHeader
          title="Monthly budget"
          description={`What each branch planned for ${formatMonth(month)}, and what actually happened. Open a branch to write or change its plan.`}
        />

        <MonthPicker month={month} branchId="" />

        <StatRow>
          <StatCard label="Income, planned" amount={totals.expectedIncome} tone="muted" />
          <StatCard label="Income, actual" amount={totals.actualIncome} />
          <StatCard label="Expenses, actual" amount={totals.actualExpenses} />
          <StatCard
            label={`Net balance, ${formatMonth(month)}`}
            amount={totals.actualNet}
            tone="balance"
            hint={`Planned ${formatMoney(totals.plannedNet)}`}
          />
        </StatRow>

        {branches.length === 0 ? (
          <EmptyRow message="No branches yet. Add one before planning a month." />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Income planned</TableHead>
                  <TableHead className="text-right">Income actual</TableHead>
                  <TableHead className="text-right">Expenses planned</TableHead>
                  <TableHead className="text-right">Expenses actual</TableHead>
                  <TableHead className="text-right">Net balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.branchId}>
                    <TableCell>
                      <Link
                        href={`/finance/budget?month=${month}&branch=${branch.branchId}`}
                        className="font-medium hover:underline"
                      >
                        {branch.branchName}
                      </Link>
                      {!branch.planned && (
                        <div className="text-xs text-muted-foreground">No plan yet</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(branch.expectedIncome)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(branch.actualIncome)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(branch.plannedExpenses)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(branch.actualExpenses)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${isNegative(branch.actualNet) ? "text-destructive" : ""}`}
                    >
                      {formatMoney(branch.actualNet)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell>The whole college</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(totals.expectedIncome)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(totals.actualIncome)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(totals.plannedExpenses)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(totals.actualExpenses)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${isNegative(totals.actualNet) ? "text-destructive" : ""}`}
                  >
                    {formatMoney(totals.actualNet)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </>
    );
  }

  const plan = await branchBudget(branchId, month);
  if (!plan) notFound();

  const incomeDifference = (Number(plan.actualIncome) - Number(plan.expectedIncome)).toFixed(2);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/finance/budget?month=${month}`}>
          <ChevronLeft />
          Every branch
        </Link>
      </Button>

      <PageHeader
        title={`${plan.branch.name}, ${formatMonth(month)}`}
        description={
          plan.budget
            ? `Planned by ${plan.budget.savedBy.name}. Saving again replaces the plan.`
            : "No plan for this month yet. Write one below."
        }
      >
        {plan.budget && (
          <ActionButton
            variant="outline"
            action={deleteBudget.bind(null, branchId, month)}
            confirm={{
              title: `Remove the plan for ${formatMonth(month)}?`,
              description:
                "Only the plan goes. Every payment and expense recorded for the month stays exactly as it is.",
              confirmLabel: "Remove the plan",
              destructive: true,
            }}
          >
            Remove the plan
          </ActionButton>
        )}
      </PageHeader>

      <MonthPicker month={month} branchId={branchId} />

      <StatRow>
        <StatCard
          label="Income"
          amount={plan.actualIncome}
          hint={`Planned ${formatMoney(plan.expectedIncome)}`}
        />
        <StatCard
          label="Expenses"
          amount={plan.actualExpenses}
          hint={`Planned ${formatMoney(plan.plannedExpenses)}`}
        />
        <StatCard
          label="Net balance"
          amount={plan.actualNet}
          tone="balance"
          hint={`Planned ${formatMoney(plan.plannedNet)}`}
        />
        <StatCard
          label="Against the plan"
          amount={(Number(plan.actualNet) - Number(plan.plannedNet)).toFixed(2)}
          tone="balance"
          hint="How the month came out against what was expected"
        />
      </StatRow>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Planned against actual</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Difference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Income</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(plan.expectedIncome)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(plan.actualIncome)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {/* Taking less than planned is the bad way for income to miss. */}
                  <Difference amount={incomeDifference} overIsBad={false} />
                </TableCell>
              </TableRow>

              {plan.lines.map((line) => (
                <TableRow key={line.category}>
                  <TableCell>{expenseCategoryLabels[line.category]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(line.planned) > 0 ? (
                      formatMoney(line.planned)
                    ) : (
                      <span className="text-muted-foreground">Not planned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(line.actual)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Difference amount={line.difference} overIsBad />
                  </TableCell>
                </TableRow>
              ))}

              <TableRow className="font-medium">
                <TableCell>Total expenses</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(plan.plannedExpenses)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(plan.actualExpenses)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Difference
                    amount={(Number(plan.actualExpenses) - Number(plan.plannedExpenses)).toFixed(2)}
                    overIsBad
                  />
                </TableCell>
              </TableRow>
              <TableRow className="font-medium">
                <TableCell>Net balance</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(plan.plannedNet)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${isNegative(plan.actualNet) ? "text-destructive" : ""}`}
                >
                  {formatMoney(plan.actualNet)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Difference
                    amount={(Number(plan.actualNet) - Number(plan.plannedNet)).toFixed(2)}
                    overIsBad={false}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {plan.budget?.note && (
          <p className="text-sm text-muted-foreground">
            <Badge variant="secondary" className="mr-2">
              Note
            </Badge>
            {plan.budget.note}
          </p>
        )}
      </section>

      <BudgetForm
        action={saveBudget.bind(null, branchId)}
        month={month}
        branchName={plan.branch.name}
        defaults={{
          expectedIncome: plan.budget ? plan.expectedIncome : "",
          note: plan.budget?.note ?? "",
          lines: Object.fromEntries(
            plan.lines
              .filter((line) => Number(line.planned) > 0)
              .map((line) => [line.category, line.planned]),
          ),
        }}
      />
    </>
  );
}

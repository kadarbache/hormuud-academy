import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { formatDateTime } from "@/lib/dates";
import { formatRate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { setExchangeRate } from "./actions";
import { RateForm } from "./rate-form";

export const metadata: Metadata = { title: "Settings" };

/** How many past rates the history shows. */
const HISTORY = 20;

export default async function SettingsPage() {
  await requireAdmin();
  const rates = await prisma.exchangeRate.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: HISTORY,
    include: { setBy: { select: { name: true } } },
  });
  const current = rates[0] ?? null;

  return (
    <>
      <PageHeader title="Settings" description="Settings for the whole college. Only the admin sees this page." />

      <Card>
        <CardHeader>
          <CardTitle>Exchange rate</CardTitle>
          <CardDescription>
            How many Somaliland shillings one US dollar is. Every combined figure on the money
            screens uses today&apos;s rate, so it shows what the college&apos;s money is worth now
            and moves when the rate does. A payment or expense in shillings keeps the rate in force
            when it&apos;s recorded, like a receipt, and fees, which are set in dollars, are turned
            into shillings at it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {current ? (
            <div className="space-y-1">
              <p className="text-2xl font-semibold tabular-nums">
                1 USD = {formatRate(current.rate.toString())} SLSH
              </p>
              <p className="text-sm text-muted-foreground">
                Set by {current.setBy.name}, {formatDateTime(current.createdAt)}
              </p>
            </div>
          ) : (
            <p className="rounded-md border border-warning-border bg-warning p-3 text-sm text-warning-foreground">
              No rate is set yet, so nothing can be recorded in shillings. Set it below.
            </p>
          )}
          <RateForm action={setExchangeRate} current={current?.rate.toString() ?? ""} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Rate history</h2>
          <p className="text-sm text-muted-foreground">
            Every rate that has been set, newest first. The latest {HISTORY} are shown.
          </p>
        </div>
        {rates.length === 0 ? (
          <EmptyRow message="No rate has been set yet." />
        ) : (
          <DataTable
            columns={[
              { label: "Set on" },
              { label: "Shillings to one dollar", className: "text-right tabular-nums" },
              { label: "Set by", className: "text-muted-foreground" },
            ]}
            rows={rates.map((rate, index) => ({
              key: rate.id,
              title: `1 USD = ${formatRate(rate.rate.toString())} SLSH`,
              description: index === 0 ? "The rate in force" : undefined,
              cells: {
                "Set on": (
                  <>
                    <div>{formatDateTime(rate.createdAt)}</div>
                    {index === 0 && (
                      <div className="text-xs text-muted-foreground">In force now</div>
                    )}
                  </>
                ),
                "Shillings to one dollar": formatRate(rate.rate.toString()),
                "Set by": rate.setBy.name,
              },
            }))}
          />
        )}
      </section>
    </>
  );
}

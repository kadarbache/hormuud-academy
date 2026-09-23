import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SelectInput } from "@/components/select-input";
import { EmptyRow } from "@/components/status-badge";
import { formatMonth } from "@/lib/dates";
import { formatMoney, formatStudentNumber } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { requireUser } from "@/lib/session";
import { StatCard, StatRow } from "../figures";
import { ANY, withAnyOption } from "../labels";
import { branchOptions } from "../income/queries";
import { listOwed, PAGE_SIZE, readOwedFilters, type OwedFilters, type OwedSkill } from "./queries";

export const metadata: Metadata = { title: "Fees owed" };

const warning = "border-warning-border bg-warning text-warning-foreground";

function pageHref(filters: OwedFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.branchId) params.set("branch", filters.branchId);
  if (filters.q) params.set("q", filters.q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/finance/owed?${query}` : "/finance/owed";
}

/** "registration fee $15.00 · 2 months at $30.00: Sept 2026, Oct 2026" */
function owedFor(skill: OwedSkill) {
  const parts: string[] = [];
  if (Number(skill.registrationOwed) > 0) {
    parts.push(`registration fee ${formatMoney(skill.registrationOwed)}`);
  }
  if (skill.unpaidMonths.length > 0) {
    const months = skill.unpaidMonths.map(formatMonth);
    const listed =
      months.length > 3
        ? `${months.slice(0, 3).join(", ")} and ${months.length - 3} more`
        : months.join(", ");
    parts.push(
      `${skill.unpaidMonths.length === 1 ? "1 month" : `${skill.unpaidMonths.length} months`} at ${formatMoney(skill.monthlyFee)}: ${listed}`,
    );
  }
  return parts.join(" · ");
}

export default async function OwedPage({ searchParams }: PageProps<"/finance/owed">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const filters = readOwedFilters(await searchParams);

  const [owed, branches] = await Promise.all([
    listOwed(user, filters),
    isAdmin ? branchOptions() : [],
  ]);

  const firstShown = (filters.page - 1) * PAGE_SIZE + 1;
  const filtered = Boolean(filters.branchId || filters.q);

  return (
    <>
      <PageHeader
        title="Fees owed"
        description={
          isAdmin
            ? "Every student with a registration fee or a month still unpaid, the biggest first."
            : "Students at your branch with a registration fee or a month still unpaid, the biggest first."
        }
      />

      <Form key={JSON.stringify(filters)} action="/finance/owed" className="flex flex-wrap items-end gap-3">
        {isAdmin && (
          <div className="grid gap-1.5">
            <Label htmlFor="branch">Branch</Label>
            <SelectInput
              id="branch"
              name="branch"
              options={withAnyOption(
                branches.map((branch) => ({ value: branch.id, label: branch.name })),
                "Every branch",
              )}
              defaultValue={filters.branchId || ANY}
              className="w-44"
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="q">Student</Label>
          <Input
            id="q"
            name="q"
            defaultValue={filters.q}
            placeholder="ID, phone or name"
            className="w-52"
          />
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {filtered && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/finance/owed">Clear</Link>
          </Button>
        )}
      </Form>

      <StatRow columns={3}>
        <StatCard
          label="Owed altogether"
          amount={owed.owedAltogether}
          hint={owed.total === 1 ? "1 student" : `${owed.total} students`}
        />
        <StatCard tone="muted" label="Registration fees" amount={owed.registrationOwed} />
        <StatCard
          tone="muted"
          label="Monthly fees"
          amount={owed.monthlyOwed}
          hint={owed.monthsOwed === 1 ? "1 month unpaid" : `${owed.monthsOwed} months unpaid`}
        />
      </StatRow>

      {owed.students.length === 0 ? (
        <EmptyRow
          message={
            filtered
              ? "No students match, or the ones that do have paid everything."
              : "Nobody owes anything. Every fee due so far has been paid."
          }
        />
      ) : (
        <>
          <DataTable
            columns={[
              { label: "Student" },
              { label: "Phone" },
              ...(isAdmin ? [{ label: "Home branch" }] : []),
              { label: "What's owed", className: "max-w-96 whitespace-normal" },
              { label: "Amount", className: "text-right" },
            ]}
            rows={owed.students.map((student) => ({
              key: student.id,
              title: student.fullName,
              description: `${formatStudentNumber(student.number)} owes ${formatMoney(student.owed)}`,
              cells: {
                Student: (
                  <>
                    <Link href={`/students/${student.id}`} className="font-medium hover:underline">
                      {student.fullName}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">
                      {formatStudentNumber(student.number)}
                    </div>
                  </>
                ),
                Phone: formatPhone(student.phone) || "—",
                "Home branch": student.homeBranchName,
                "What's owed": (
                  <div className="space-y-1">
                    {student.skills.map((skill) => (
                      <div key={skill.enrollmentId}>
                        <span className="font-medium">{skill.skillName}</span>
                        {isAdmin && (
                          <span className="text-muted-foreground"> at {skill.branchName}</span>
                        )}
                        <div className="text-xs text-muted-foreground">{owedFor(skill)}</div>
                      </div>
                    ))}
                  </div>
                ),
                Amount: (
                  <Badge variant="outline" className={`tabular-nums ${warning}`}>
                    {formatMoney(student.owed)}
                  </Badge>
                ),
              },
            }))}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {firstShown} to {firstShown + owed.students.length - 1} of {owed.total}
            </span>
            {owed.pageCount > 1 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={pageHref(filters, filters.page - 1)}
                    aria-disabled={filters.page <= 1}
                    className={filters.page <= 1 ? "pointer-events-none opacity-50" : undefined}
                  >
                    <ChevronLeft />
                    Previous
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={pageHref(filters, filters.page + 1)}
                    aria-disabled={filters.page >= owed.pageCount}
                    className={
                      filters.page >= owed.pageCount ? "pointer-events-none opacity-50" : undefined
                    }
                  >
                    Next
                    <ChevronRight />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

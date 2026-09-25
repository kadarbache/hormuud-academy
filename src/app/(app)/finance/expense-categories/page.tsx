import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { TEACHER_SALARY_ID } from "../labels";
import {
  createExpenseCategory,
  deleteExpenseCategory,
  renameExpenseCategory,
  setExpenseCategoryActive,
} from "./actions";
import { ExpenseCategoryDialog } from "./expense-category-dialog";

export const metadata: Metadata = { title: "Expense categories" };

export default async function ExpenseCategoriesPage() {
  await requireAdmin();
  const categories = await prisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { expenses: true, budgetLines: true } } },
  });

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/finance/expenses">
          <ChevronLeft />
          Expenses
        </Link>
      </Button>

      <PageHeader
        title="Expense categories"
        description="What the college's money goes on. Record expense and the monthly budget offer the active ones."
      >
        <ExpenseCategoryDialog
          action={createExpenseCategory}
          trigger={
            <Button>
              <Plus />
              Add category
            </Button>
          }
        />
      </PageHeader>

      <DataTable
        columns={[
          { label: "Category", className: "font-medium" },
          { label: "Expenses", className: "text-right tabular-nums" },
          { label: "Budget plans", className: "text-right tabular-nums" },
          { label: "Status" },
          { label: "Actions", actions: true, className: "text-right" },
        ]}
        rows={categories.map((category) => {
          const builtIn = category.id === TEACHER_SALARY_ID;
          const unused = category._count.expenses === 0 && category._count.budgetLines === 0;
          return {
            key: category.id,
            title: category.name,
            description: builtIn
              ? "Built in. Teacher pay is recorded here, so it can't be renamed, deactivated or deleted."
              : undefined,
            cells: {
              Category: category.name,
              Expenses: category._count.expenses,
              "Budget plans": category._count.budgetLines,
              Status: builtIn ? (
                <Badge variant="outline">Built in</Badge>
              ) : (
                <ActiveBadge active={category.active} />
              ),
              Actions: builtIn ? null : (
                <div className="flex justify-end gap-1">
                  <ExpenseCategoryDialog
                    action={renameExpenseCategory.bind(null, category.id)}
                    category={{ name: category.name }}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Rename
                      </Button>
                    }
                  />
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    action={setExpenseCategoryActive.bind(null, category.id, !category.active)}
                  >
                    {category.active ? "Deactivate" : "Activate"}
                  </ActionButton>
                  {unused && (
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      action={deleteExpenseCategory.bind(null, category.id)}
                      confirm={{
                        title: `Delete ${category.name}?`,
                        description:
                          "Nothing has been spent or planned in this category, so it can be deleted for good.",
                        confirmLabel: "Delete category",
                        destructive: true,
                      }}
                    >
                      Delete
                    </ActionButton>
                  )}
                </div>
              ),
            },
          };
        })}
      />

      <p className="text-sm text-muted-foreground">
        A category that money has been spent or planned in can&apos;t be deleted, because that would
        change what past months add up to. Deactivate it instead: it leaves the Record expense list
        and the budget form, and its old expenses keep it.
      </p>
    </>
  );
}

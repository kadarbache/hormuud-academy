import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { CategoryDialog } from "./category-dialog";
import { createCategory, deleteCategory, setCategoryActive, updateCategory } from "./actions";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { skills: true } } },
  });

  return (
    <>
      <PageHeader title="Categories" description="Groups for the skill catalog, like Technology Skills and Hand Skills.">
        <CategoryDialog
          action={createCategory}
          trigger={
            <Button>
              <Plus />
              Add category
            </Button>
          }
        />
      </PageHeader>

      {categories.length === 0 ? (
        <EmptyRow message="No categories yet." />
      ) : (
        <DataTable
          columns={[
            { label: "Category", className: "font-medium" },
            { label: "Skills", className: "text-right tabular-nums" },
            { label: "Status" },
            { label: "Actions", actions: true, className: "text-right" },
          ]}
          rows={categories.map((category) => ({
            key: category.id,
            title: category.name,
            cells: {
              Category: category.name,
              Skills: category._count.skills,
              Status: <ActiveBadge active={category.active} />,
              Actions: (
                <div className="flex justify-end gap-1">
                  <CategoryDialog
                    action={updateCategory.bind(null, category.id)}
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
                    action={setCategoryActive.bind(null, category.id, !category.active)}
                  >
                    {category.active ? "Deactivate" : "Activate"}
                  </ActionButton>
                  {category._count.skills === 0 && (
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      action={deleteCategory.bind(null, category.id)}
                      confirm={{
                        title: `Delete ${category.name}?`,
                        description: "No skill uses this category, so it can be deleted for good.",
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
          }))}
        />
      )}
    </>
  );
}

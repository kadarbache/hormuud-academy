import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { BranchDialog } from "./branch-dialog";
import { createBranch, deleteBranch, setBranchActive, updateBranch } from "./actions";

export const metadata: Metadata = { title: "Branches" };

export default async function BranchesPage() {
  const branches = await prisma.branch.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { staff: true, classrooms: true, teachers: true, branchSkills: true, homeStudents: true },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Branches"
        description="Every branch of the college. Staff, classes and students each belong to one."
      >
        <BranchDialog
          action={createBranch}
          trigger={
            <Button>
              <Plus />
              Add branch
            </Button>
          }
        />
      </PageHeader>

      {branches.length === 0 ? (
        <EmptyRow message="No branches yet. Add the first one." />
      ) : (
        <DataTable
          columns={[
            { label: "Branch" },
            { label: "Phone" },
            { label: "Registered students", className: "text-right tabular-nums" },
            { label: "Skills", className: "text-right tabular-nums" },
            { label: "Status" },
            { label: "Actions", actions: true, className: "text-right" },
          ]}
          rows={branches.map((branch) => {
            const inUse = Object.values(branch._count).some((count) => count > 0);
            return {
              key: branch.id,
              title: branch.name,
              description: branch.address ?? undefined,
              cells: {
                Branch: (
                  <>
                    <div className="font-medium">{branch.name}</div>
                    {branch.address && (
                      <div className="text-xs text-muted-foreground">{branch.address}</div>
                    )}
                  </>
                ),
                Phone: formatPhone(branch.phone) || "—",
                "Registered students": branch._count.homeStudents,
                Skills: branch._count.branchSkills,
                Status: <ActiveBadge active={branch.active} />,
                Actions: (
                  <div className="flex justify-end gap-1">
                    <BranchDialog
                      action={updateBranch.bind(null, branch.id)}
                      branch={{ name: branch.name, phone: branch.phone, address: branch.address }}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      }
                    />
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      action={setBranchActive.bind(null, branch.id, !branch.active)}
                    >
                      {branch.active ? "Deactivate" : "Activate"}
                    </ActionButton>
                    {!inUse && (
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        action={deleteBranch.bind(null, branch.id)}
                        confirm={{
                          title: `Delete ${branch.name}?`,
                          description: "Nothing uses this branch yet, so it can be deleted for good.",
                          confirmLabel: "Delete branch",
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
      )}
    </>
  );
}

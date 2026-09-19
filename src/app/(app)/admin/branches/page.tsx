import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
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
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Registered students</TableHead>
                <TableHead className="text-right">Skills</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => {
                const inUse = Object.values(branch._count).some((count) => count > 0);
                return (
                  <TableRow key={branch.id}>
                    <TableCell>
                      <div className="font-medium">{branch.name}</div>
                      {branch.address && (
                        <div className="text-xs text-muted-foreground">{branch.address}</div>
                      )}
                    </TableCell>
                    <TableCell>{branch.phone ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{branch._count.homeStudents}</TableCell>
                    <TableCell className="text-right tabular-nums">{branch._count.branchSkills}</TableCell>
                    <TableCell>
                      <ActiveBadge active={branch.active} />
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

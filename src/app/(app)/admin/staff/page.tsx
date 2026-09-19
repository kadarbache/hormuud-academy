import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ResetPasswordDialog, StaffAccountDialog } from "./staff-dialogs";
import {
  createStaffAccount,
  resetStaffPassword,
  setStaffActive,
  updateStaffAccount,
} from "./actions";

export const metadata: Metadata = { title: "Staff accounts" };

export default async function StaffPage() {
  const me = await requireAdmin();
  const [accounts, branches] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { branch: { select: { name: true } } },
    }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const branchOptions = branches.map((branch) => ({ value: branch.id, label: branch.name }));

  return (
    <>
      <PageHeader
        title="Staff accounts"
        description="Everyone who can log in. Branch staff only see their own branch."
      >
        <StaffAccountDialog
          action={createStaffAccount}
          branches={branchOptions}
          trigger={
            <Button>
              <Plus />
              Add staff account
            </Button>
          }
        />
      </PageHeader>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const isSelf = account.id === me.id;
              const role = account.role === "admin" ? "admin" : "staff";
              // Keep the person's current branch pickable even if it was deactivated.
              const options =
                account.branchId && !branchOptions.some((option) => option.value === account.branchId)
                  ? [{ value: account.branchId, label: account.branch?.name ?? "Current branch" }, ...branchOptions]
                  : branchOptions;

              return (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="font-medium">
                      {account.name}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{account.email}</div>
                  </TableCell>
                  <TableCell>{role === "admin" ? "Admin" : "Branch staff"}</TableCell>
                  <TableCell>{role === "admin" ? "All branches" : (account.branch?.name ?? "Not set")}</TableCell>
                  <TableCell>
                    {account.banned ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Deactivated
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <StaffAccountDialog
                        action={updateStaffAccount.bind(null, account.id)}
                        branches={options}
                        account={{ name: account.name, email: account.email, role, branchId: account.branchId }}
                        isSelf={isSelf}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        }
                      />
                      <ResetPasswordDialog
                        action={resetStaffPassword.bind(null, account.id)}
                        name={account.name}
                        trigger={
                          <Button variant="ghost" size="sm">
                            New password
                          </Button>
                        }
                      />
                      {!isSelf && (
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          action={setStaffActive.bind(null, account.id, Boolean(account.banned))}
                          confirm={
                            account.banned
                              ? undefined
                              : {
                                  title: `Deactivate ${account.name}?`,
                                  description:
                                    "They are logged out and can't log in until you turn the account back on. Their students and records stay.",
                                  confirmLabel: "Deactivate",
                                  destructive: true,
                                }
                          }
                        >
                          {account.banned ? "Turn back on" : "Deactivate"}
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
    </>
  );
}

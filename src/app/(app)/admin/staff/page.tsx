import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
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
  const [accounts, branches, teachers] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: {
        branch: { select: { name: true } },
        teacher: {
          select: {
            name: true,
            branches: { select: { branch: { select: { name: true } } } },
          },
        },
        accounts: { select: { providerId: true } },
      },
    }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.teacher.findMany({
      where: { OR: [{ active: true }, { login: { isNot: null } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true, login: { select: { id: true } } },
    }),
  ]);
  const branchOptions = branches.map((branch) => ({ value: branch.id, label: branch.name }));
  // A teacher has one login, so only active ones without one are offered,
  // plus the one an account being edited is already for, even if deactivated.
  const teacherOptions = (accountId?: string) =>
    teachers
      .filter((teacher) =>
        teacher.login ? teacher.login.id === accountId : teacher.active,
      )
      .map((teacher) => ({ value: teacher.id, label: teacher.name }));

  return (
    <>
      <PageHeader
        title="Staff accounts"
        description="Everyone who can log in. Branch staff only see their own branch, and a teacher only their own class times and pay."
      >
        <StaffAccountDialog
          action={createStaffAccount}
          branches={branchOptions}
          teachers={teacherOptions()}
          trigger={
            <Button>
              <Plus />
              Add staff account
            </Button>
          }
        />
      </PageHeader>

      <DataTable
        columns={[
          { label: "Name" },
          { label: "Role" },
          { label: "Branch" },
          { label: "Signs in with" },
          { label: "Status" },
          { label: "Actions", actions: true, className: "text-right" },
        ]}
        rows={accounts.map((account) => {
          const isSelf = account.id === me.id;
          const role =
            account.role === "admin" ? "admin" : account.role === "teacher" ? "teacher" : "staff";
          // Keep the person's current branch pickable even if it was deactivated.
          const options =
            account.branchId && !branchOptions.some((option) => option.value === account.branchId)
              ? [{ value: account.branchId, label: account.branch?.name ?? "Current branch" }, ...branchOptions]
              : branchOptions;
          // Google is linked on the person's first Google sign-in. A password
          // is left over from before Google sign-in.
          const hasGoogle = account.accounts.some((a) => a.providerId === "google");
          const hasPassword = account.accounts.some((a) => a.providerId === "credential");

          return {
            key: account.id,
            title: account.name,
            description: account.email,
            cells: {
              Name: (
                <>
                  <div className="font-medium">
                    {account.name}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{account.email}</div>
                </>
              ),
              Role:
                role === "admin" ? (
                  "Admin"
                ) : role === "teacher" ? (
                  <>
                    Teacher
                    {account.teacher && account.teacher.name !== account.name && (
                      <div className="text-xs text-muted-foreground">{account.teacher.name}</div>
                    )}
                  </>
                ) : (
                  "Branch staff"
                ),
              Branch:
                role === "admin"
                  ? "All branches"
                  : role === "teacher"
                    ? (account.teacher?.branches.map((link) => link.branch.name).join(", ") ?? "Not set")
                    : (account.branch?.name ?? "Not set"),
              "Signs in with": hasGoogle ? (
                hasPassword ? "Google or password" : "Google"
              ) : hasPassword ? (
                "Password"
              ) : (
                <span className="text-muted-foreground">Google, not signed in yet</span>
              ),
              Status: account.banned ? (
                <Badge variant="outline" className="text-muted-foreground">
                  Deactivated
                </Badge>
              ) : (
                <Badge variant="secondary">Active</Badge>
              ),
              Actions: (
                <div className="flex justify-end gap-1">
                  <StaffAccountDialog
                    action={updateStaffAccount.bind(null, account.id)}
                    branches={options}
                    teachers={teacherOptions(account.id)}
                    account={{
                      name: account.name,
                      email: account.email,
                      role,
                      branchId: account.branchId,
                      teacherId: account.teacherId,
                    }}
                    isSelf={isSelf}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    }
                  />
                  {hasPassword && (
                    <ResetPasswordDialog
                      action={resetStaffPassword.bind(null, account.id)}
                      name={account.name}
                      trigger={
                        <Button variant="ghost" size="sm">
                          New password
                        </Button>
                      }
                    />
                  )}
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
              ),
            },
          };
        })}
      />
    </>
  );
}

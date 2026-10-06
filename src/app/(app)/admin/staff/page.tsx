import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { IssuePasswordButton } from "@/components/issue-password-button";
import { PageHeader } from "@/components/page-header";
import { formatDateTime } from "@/lib/dates";
import { formatTeacherNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { isMadeUpEmail, TEMPORARY_PASSWORD_HOURS } from "@/lib/teacher-logins";
import { ResetPasswordDialog, StaffAccountDialog } from "./staff-dialogs";
import { TeacherLoginHistory } from "./teacher-login-history";
import { giveTeacherPassword, removeTeacherPassword } from "./teacher-password-actions";
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
      // Student logins are managed on each student's page.
      where: { studentId: null },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: {
        branch: { select: { name: true } },
        teacher: {
          select: {
            name: true,
            number: true,
            branches: { select: { branch: { select: { name: true } } } },
            loginEvents: {
              orderBy: { createdAt: "desc" },
              take: 30,
              select: {
                id: true,
                action: true,
                ipAddress: true,
                createdAt: true,
                by: { select: { id: true, name: true } },
              },
            },
          },
        },
        accounts: { select: { providerId: true } },
      },
    }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.teacher.findMany({
      where: { OR: [{ active: true }, { login: { isNot: null } }] },
      orderBy: { name: "asc" },
      select: { id: true, number: true, name: true, active: true, login: { select: { id: true } } },
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
      .map((teacher) => ({
        value: teacher.id,
        label: `${teacher.name} (${formatTeacherNumber(teacher.number)})`,
      }));
  const now = new Date();

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
          // Google is linked on the person's first Google sign-in. Staff with
          // a password have it from before Google sign-in; a teacher's is
          // from the admin, under Give password.
          const hasGoogle = account.accounts.some((a) => a.providerId === "google");
          const hasPassword = account.accounts.some((a) => a.providerId === "credential");
          // A teacher login with no Gmail has a made-up email, never shown.
          const noGmail = isMadeUpEmail(account.email);
          const teacher = role === "teacher" ? account.teacher : null;
          const teacherId = teacher ? formatTeacherNumber(teacher.number) : null;
          const shownEmail = noGmail ? "No Gmail" : account.email;

          return {
            key: account.id,
            title: account.name,
            description: noGmail ? teacherId : account.email,
            cells: {
              Name: (
                <>
                  <div className="font-medium">
                    {account.name}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{shownEmail}</div>
                </>
              ),
              Role:
                role === "admin" ? (
                  "Admin"
                ) : teacher ? (
                  <>
                    Teacher
                    <div className="text-xs text-muted-foreground">
                      {teacher.name !== account.name && `${teacher.name}, `}
                      {teacherId}
                    </div>
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
              "Signs in with": teacher ? (
                <TeacherSignIn
                  hasGoogle={hasGoogle}
                  noGmail={noGmail}
                  hasPassword={hasPassword}
                  temporaryUntil={
                    account.mustChangePassword ? account.temporaryPasswordExpires : null
                  }
                  now={now}
                />
              ) : hasGoogle ? (
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
                <div className="flex flex-wrap justify-end gap-1">
                  <StaffAccountDialog
                    action={updateStaffAccount.bind(null, account.id)}
                    branches={options}
                    teachers={teacherOptions(account.id)}
                    account={{
                      name: account.name,
                      // Left blank, so saving keeps a teacher without Gmail that way.
                      email: noGmail ? "" : account.email,
                      shownAs: noGmail && teacherId ? teacherId : account.email,
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
                  {teacher && teacherId && !account.banned && (
                    <IssuePasswordButton
                      action={giveTeacherPassword.bind(null, account.id)}
                      who="teacher"
                      loginId={teacherId}
                      expiresNote={`It stops working in ${TEMPORARY_PASSWORD_HOURS} hours if they don't.`}
                      label={hasPassword ? "Reset password" : "Give password"}
                      variant="ghost"
                      title={
                        hasPassword
                          ? `Give ${teacher.name} a new password?`
                          : `Give ${teacher.name} a password?`
                      }
                      description={
                        hasPassword
                          ? `Their old password stops working and they're logged out everywhere. You'll see a temporary password once; it works for ${TEMPORARY_PASSWORD_HOURS} hours.`
                          : `They'll sign in with ${teacherId} and a password${noGmail ? "" : " as well as Google"}. You'll see a temporary password once; it works for ${TEMPORARY_PASSWORD_HOURS} hours, and they choose their own the first time they sign in.`
                      }
                      confirmLabel={hasPassword ? "Reset password" : "Give password"}
                    />
                  )}
                  {teacher && hasPassword && !noGmail && (
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      action={removeTeacherPassword.bind(null, account.id)}
                      confirm={{
                        title: `Take away ${teacher.name}'s password?`,
                        description:
                          "They'll sign in with Google only, and they're logged out everywhere now.",
                        confirmLabel: "Take it away",
                        destructive: true,
                      }}
                    >
                      Remove password
                    </ActionButton>
                  )}
                  {teacher && (
                    <TeacherLoginHistory
                      name={teacher.name}
                      loginId={account.id}
                      events={teacher.loginEvents}
                    />
                  )}
                  {!teacher && hasPassword && (
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

/** How a teacher login gets in: Google, their Teacher ID and password, or both. */
function TeacherSignIn({
  hasGoogle,
  noGmail,
  hasPassword,
  temporaryUntil,
  now,
}: {
  hasGoogle: boolean;
  noGmail: boolean;
  hasPassword: boolean;
  /** When the temporary password stops working, while they're still on it. */
  temporaryUntil: Date | null;
  now: Date;
}) {
  const google = hasGoogle ? "Google" : noGmail ? null : "Google, not signed in yet";
  const password = !hasPassword
    ? null
    : !temporaryUntil
      ? "Teacher ID and password"
      : temporaryUntil > now
        ? `Temporary password until ${formatDateTime(temporaryUntil)}`
        : "Temporary password, expired";

  if (!google && !password) {
    return <span className="text-muted-foreground">No way in yet. Give them a password.</span>;
  }
  return (
    <>
      {google && <div className={hasGoogle ? undefined : "text-muted-foreground"}>{google}</div>}
      {password && (
        <div className={temporaryUntil ? "text-xs text-muted-foreground" : undefined}>{password}</div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

type Role = "admin" | "staff" | "teacher";

const roleOptions: Option[] = [
  { value: "staff", label: "Branch staff" },
  { value: "teacher", label: "Teacher" },
  { value: "admin", label: "Admin" },
];

const roleDescriptions: Record<Role, string> = {
  admin: "Admins see every branch and manage skills, teachers, classes and accounts.",
  staff: "Branch staff register and enroll students at their own branch.",
  teacher:
    "A teacher takes today's attendance for the class times they teach and sees their own pay. Nothing else. They sign in with Google, or their Teacher ID and a password you give them.",
};

export function StaffAccountDialog({
  action,
  branches,
  teachers,
  account,
  isSelf = false,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  branches: Option[];
  /** Active teachers with no login yet, and the one this account is for. */
  teachers: Option[];
  /** Missing when creating a new account. */
  account?: {
    name: string;
    /** Blank for a teacher with no Gmail. */
    email: string;
    /** The email, or the Teacher ID of a teacher with no Gmail. */
    shownAs: string;
    role: Role;
    branchId: string | null;
    teacherId: string | null;
  };
  isSelf?: boolean;
  trigger: React.ReactNode;
}) {
  const [role, setRole] = useState<Role>(account?.role ?? "staff");

  return (
    <FormDialog
      title={account ? `Edit ${account.name}` : "Add staff account"}
      description={
        account
          ? account.shownAs
          : "The person signs in with the Google account that has this email. A teacher can sign in with a Teacher ID and password instead. There is no sign-up page."
      }
      trigger={trigger}
      action={action}
      submitLabel={account ? "Save" : "Create account"}
    >
      {(errors) => (
        <>
          <TextField label="Name" name="name" defaultValue={account?.name} required errors={errors.name} />
          <TextField
            label="Gmail address"
            name="email"
            type="email"
            autoComplete="off"
            defaultValue={account?.email}
            description={
              role === "teacher"
                ? "Optional for a teacher. Leave it blank if they have no Google account: they'll sign in with their Teacher ID and a password you give them."
                : account
                  ? "Changing it logs them out. They sign back in with the Google account for the new address."
                  : "The address of their Google account. Tell them yourself that the account is ready."
            }
            required={role !== "teacher"}
            errors={errors.email}
          />
          <SelectField
            label="Role"
            name="role"
            options={roleOptions}
            value={role}
            onValueChange={(value) => setRole(value as Role)}
            disabled={isSelf}
            description={isSelf ? "You can't change your own role." : roleDescriptions[role]}
            errors={errors.role}
          />
          {/* A disabled select isn't submitted, so send the role another way. */}
          {isSelf && <input type="hidden" name="role" value={role} />}
          {role === "staff" && (
            <SelectField
              label="Branch"
              name="branchId"
              options={branches}
              placeholder="Pick a branch"
              defaultValue={account?.branchId ?? ""}
              errors={errors.branchId}
            />
          )}
          {role === "teacher" && (
            <SelectField
              label="Teacher"
              name="teacherId"
              options={teachers}
              placeholder={teachers.length > 0 ? "Pick a teacher" : "Every active teacher has a login"}
              defaultValue={account?.teacherId ?? ""}
              description="They see this teacher's class times and pay."
              errors={errors.teacherId}
            />
          )}
        </>
      )}
    </FormDialog>
  );
}

export function ResetPasswordDialog({
  action,
  name,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  name: string;
  trigger: React.ReactNode;
}) {
  return (
    <FormDialog
      title={`New password for ${name}`}
      description="Use this when someone forgets their password. Tell them the new one yourself."
      trigger={trigger}
      action={action}
      submitLabel="Set password"
    >
      {(errors) => (
        <TextField
          label="New password"
          name="password"
          type="text"
          autoComplete="new-password"
          description="At least 8 characters."
          required
          errors={errors.password}
        />
      )}
    </FormDialog>
  );
}

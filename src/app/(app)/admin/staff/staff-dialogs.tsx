"use client";

import { useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

const roleOptions: Option[] = [
  { value: "staff", label: "Branch staff" },
  { value: "admin", label: "Admin" },
];

export function StaffAccountDialog({
  action,
  branches,
  account,
  isSelf = false,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  branches: Option[];
  /** Missing when creating a new account. */
  account?: { name: string; email: string; role: "admin" | "staff"; branchId: string | null };
  isSelf?: boolean;
  trigger: React.ReactNode;
}) {
  const [role, setRole] = useState(account?.role ?? "staff");

  return (
    <FormDialog
      title={account ? `Edit ${account.name}` : "Add staff account"}
      description={
        account
          ? account.email
          : "The person logs in with this email and password. There is no sign-up page."
      }
      trigger={trigger}
      action={action}
      submitLabel={account ? "Save" : "Create account"}
    >
      {(errors) => (
        <>
          <TextField label="Name" name="name" defaultValue={account?.name} required errors={errors.name} />
          {!account && (
            <TextField
              label="Email"
              name="email"
              type="email"
              autoComplete="off"
              required
              errors={errors.email}
            />
          )}
          <SelectField
            label="Role"
            name="role"
            options={roleOptions}
            value={role}
            onChange={(event) => setRole(event.target.value as "admin" | "staff")}
            disabled={isSelf}
            description={
              isSelf
                ? "You can't change your own role."
                : role === "admin"
                  ? "Admins see every branch and manage skills, teachers, classes and accounts."
                  : "Branch staff register and enroll students at their own branch."
            }
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
          {!account && (
            <TextField
              label="Password"
              name="password"
              type="text"
              autoComplete="new-password"
              description="At least 8 characters. You'll give it to the person yourself."
              required
              errors={errors.password}
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

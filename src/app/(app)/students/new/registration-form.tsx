"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FormError, SelectField, TextField, type Option } from "@/components/form-fields";
import { useFormAction } from "@/hooks/use-form-action";
import { registerStudent } from "../actions";
import { SkillPicker, StudentProfileFields } from "../student-fields";
import type { BranchSkillOption } from "../types";

export function RegistrationForm({
  branches,
  fixedBranch,
  branchSkills,
  today,
  photoEnabled,
}: {
  /** Branches an admin can pick from. Null for branch staff. */
  branches: Option[] | null;
  /** The staff member's own branch. Null for an admin. */
  fixedBranch: { id: string; name: string } | null;
  branchSkills: BranchSkillOption[];
  today: string;
  photoEnabled: boolean;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(fixedBranch?.id ?? "");
  const { pending, fieldErrors, formError, onSubmit } = useFormAction(registerStudent, {
    onSuccess: (result) => {
      if (result.data) router.push(`/students/${result.data.id}`);
    },
  });

  const options = branchSkills.filter((option) => option.branchId === branchId);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Student</CardTitle>
          <CardDescription>
            {fixedBranch
              ? `Registered at ${fixedBranch.name}. The student gets the next STU number.`
              : "The student gets the next STU number."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {branches && (
              <SelectField
                label="Home branch"
                name="homeBranchId"
                options={branches}
                placeholder="Pick a branch"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                description="The branch the student registers at."
                errors={fieldErrors.homeBranchId}
              />
            )}
            <StudentProfileFields
              errors={fieldErrors}
              defaults={{
                fullName: "",
                sex: "",
                phone: "",
                responsiblePhone: "",
                registrationDate: today,
                homeBranchId: branchId,
                photoUrl: null,
              }}
              today={today}
              photoEnabled={photoEnabled}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>
            Pick one or more. You can add more later from the student&apos;s page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <TextField
              label="Start date"
              name="startDate"
              type="date"
              defaultValue={today}
              description="The day the student starts these skills. Each end date follows from the skill's duration."
              required
              errors={fieldErrors.startDate}
            />
            {/* Keyed on the branch so switching branch clears the ticked skills. */}
            <SkillPicker
              key={branchId}
              options={options}
              errors={fieldErrors.branchSkillIds}
              emptyMessage={
                branchId
                  ? "This branch has no open skills. An admin sets them up under Skills."
                  : "Pick the home branch first."
              }
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <FormError message={formError} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/students">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          Register student
        </Button>
      </div>
    </form>
  );
}

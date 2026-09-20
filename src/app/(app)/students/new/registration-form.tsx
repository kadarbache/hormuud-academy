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
import { RegistrationFeePaidField, SkillPicker, StudentProfileFields } from "../student-fields";
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
  const [picked, setPicked] = useState<string[]>([]);
  const { pending, fieldErrors, formError, onSubmit } = useFormAction(registerStudent, {
    onSuccess: (result) => {
      if (result.data) router.push(`/students/${result.data.id}`);
    },
  });

  const options = branchSkills.filter((option) => option.branchId === branchId);
  const pickedOptions = options.filter((option) => picked.includes(option.id));

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
                onValueChange={(value) => {
                  // Another branch has other skills, so the ticked ones go.
                  setBranchId(value);
                  setPicked([]);
                }}
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
            <SkillPicker
              options={options}
              picked={picked}
              onPickedChange={setPicked}
              errors={fieldErrors.branchSkillIds}
              emptyMessage={
                branchId
                  ? "This branch has no open skills. An admin sets them up under Skills."
                  : "Pick the home branch first."
              }
            />
            <RegistrationFeePaidField
              skills={pickedOptions}
              description="Tick it if the student paid now. It's recorded as paid on the registration date. If they'll pay later, record it on their page once they do."
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

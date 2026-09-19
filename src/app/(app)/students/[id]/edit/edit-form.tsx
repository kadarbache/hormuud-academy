"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FormError, SelectField, type Option } from "@/components/form-fields";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/action-result";
import { StudentProfileFields } from "../../student-fields";
import type { StudentFormValues } from "../../types";

export function EditStudentForm({
  action,
  studentId,
  defaults,
  branches,
  today,
  photoEnabled,
}: {
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  studentId: string;
  defaults: StudentFormValues;
  /** Only admins can move a student to another home branch. */
  branches: Option[] | null;
  today: string;
  photoEnabled: boolean;
}) {
  const router = useRouter();
  const { pending, fieldErrors, formError, onSubmit } = useFormAction(action, {
    onSuccess: () => router.push(`/students/${studentId}`),
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardContent>
          <FieldGroup>
            {branches && (
              <SelectField
                label="Home branch"
                name="homeBranchId"
                options={branches}
                defaultValue={defaults.homeBranchId}
                description="Moving a student doesn't move their skills. Those stay at the branch that teaches them."
                errors={fieldErrors.homeBranchId}
              />
            )}
            <StudentProfileFields
              errors={fieldErrors}
              defaults={defaults}
              today={today}
              photoEnabled={photoEnabled}
              studentId={studentId}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <FormError message={formError} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={`/students/${studentId}`}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          Save details
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField, type Option } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

export function SkillDialog({
  action,
  categories,
  skill,
  trigger,
}: {
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  categories: Option[];
  skill?: { name: string; categoryId: string; durationMonths: number; monthlyFee: string };
  trigger: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <FormDialog
      title={skill ? "Edit skill" : "Add skill"}
      description={
        skill
          ? "A new fee or duration applies to students who join from now on. Current students keep theirs."
          : "The skill is shared by every branch. You pick each branch's teacher and class next."
      }
      trigger={trigger}
      action={async (formData) => {
        const result = await action(formData);
        // After adding, go straight to the page where branches are set up.
        if (result.ok && result.data) router.push(`/admin/skills/${result.data.id}`);
        return result;
      }}
      submitLabel={skill ? "Save" : "Add skill"}
    >
      {(errors) => (
        <>
          <TextField
            label="Name"
            name="name"
            defaultValue={skill?.name}
            placeholder="Graphic Design"
            required
            errors={errors.name}
          />
          <SelectField
            label="Category"
            name="categoryId"
            options={categories}
            placeholder="Pick a category"
            defaultValue={skill?.categoryId ?? ""}
            errors={errors.categoryId}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Duration in months"
              name="durationMonths"
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              step={1}
              defaultValue={skill?.durationMonths ?? ""}
              required
              errors={errors.durationMonths}
            />
            <TextField
              label="Monthly fee (USD)"
              name="monthlyFee"
              inputMode="decimal"
              placeholder="20.00"
              defaultValue={skill?.monthlyFee ?? ""}
              required
              errors={errors.monthlyFee}
            />
          </div>
        </>
      )}
    </FormDialog>
  );
}

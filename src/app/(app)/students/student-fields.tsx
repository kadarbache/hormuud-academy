"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { TriangleAlert, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectField, TextField } from "@/components/form-fields";
import type { FieldErrors } from "@/lib/action-result";
import { formatMoney, formatMonths } from "@/lib/format";
import { findStudentsByPhone } from "./actions";
import type { BranchSkillOption, PhoneMatch, StudentFormValues } from "./types";

const sexOptions = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

/**
 * A phone field that warns, without blocking, when another student already
 * has the number. Families often share one phone, so it's only a hint.
 */
function PhoneField({
  excludeId,
  ...props
}: React.ComponentProps<typeof TextField> & { excludeId?: string }) {
  const [matches, setMatches] = useState<PhoneMatch[]>([]);

  async function check(value: string) {
    setMatches(value.trim() ? await findStudentsByPhone(value, excludeId) : []);
  }

  return (
    <div className="space-y-2">
      <TextField type="tel" inputMode="tel" onBlur={(event) => check(event.currentTarget.value)} {...props} />
      {matches.length > 0 && (
        <div className="flex gap-2 rounded-md border border-warning-border bg-warning p-3 text-sm text-warning-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>This number is already on file. Check it isn&apos;t the same person:</p>
            <ul className="mt-1 space-y-0.5">
              {matches.map((match) => (
                <li key={match.id}>
                  <Link href={`/students/${match.id}`} target="_blank" className="font-medium underline">
                    {match.number} {match.fullName}
                  </Link>{" "}
                  ({match.branchName})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoField({
  enabled,
  currentUrl,
  allowRemove,
  errors,
}: {
  enabled: boolean;
  currentUrl: string | null;
  allowRemove: boolean;
  errors?: string[];
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);

  if (!enabled) {
    return (
      <Field>
        <FieldLabel>Photo</FieldLabel>
        <FieldDescription>Photo upload is off until the Cloudinary keys are added.</FieldDescription>
      </Field>
    );
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  return (
    <Field data-invalid={errors?.length ? true : undefined}>
      <FieldLabel htmlFor={id}>Photo</FieldLabel>
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={preview ?? currentUrl ?? undefined} alt="" className="object-cover" />
          <AvatarFallback>
            <UserRound className="size-6 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <Input id={id} name="photo" type="file" accept="image/*" onChange={onChange} />
      </div>
      <FieldDescription>Optional. Up to 5 MB. On a phone you can take the photo now.</FieldDescription>
      {allowRemove && currentUrl && (
        <Field orientation="horizontal">
          <Checkbox id={`${id}-remove`} name="removePhoto" />
          <FieldLabel htmlFor={`${id}-remove`} className="font-normal">
            Remove the current photo
          </FieldLabel>
        </Field>
      )}
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </Field>
  );
}

/** Name, sex, phones, registration date and photo: shared by register and edit. */
export function StudentProfileFields({
  errors,
  defaults,
  today,
  photoEnabled,
  studentId,
}: {
  errors: FieldErrors;
  defaults: StudentFormValues;
  today: string;
  photoEnabled: boolean;
  /** Set when editing, so the phone check doesn't flag the student's own number. */
  studentId?: string;
}) {
  return (
    <>
      <TextField
        label="Full name"
        name="fullName"
        defaultValue={defaults.fullName}
        autoComplete="off"
        required
        errors={errors.fullName}
      />
      <SelectField
        label="Sex"
        name="sex"
        options={sexOptions}
        placeholder="Pick one"
        defaultValue={defaults.sex}
        errors={errors.sex}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <PhoneField
          label="Phone"
          name="phone"
          defaultValue={defaults.phone}
          excludeId={studentId}
          errors={errors.phone}
        />
        <PhoneField
          label="Responsible person's phone"
          name="responsiblePhone"
          defaultValue={defaults.responsiblePhone}
          excludeId={studentId}
          errors={errors.responsiblePhone}
        />
      </div>
      <TextField
        label="Registration date"
        name="registrationDate"
        type="date"
        max={today}
        defaultValue={defaults.registrationDate}
        description="Today for new students. For a student from the old system, their original date."
        required
        errors={errors.registrationDate}
      />
      <PhotoField
        enabled={photoEnabled}
        currentUrl={defaults.photoUrl}
        allowRemove={Boolean(studentId)}
        errors={errors.photo}
      />
    </>
  );
}

/** "$10.00 to register, then $20.00 a month for 3 months" */
export function feesText(
  option: Pick<BranchSkillOption, "registrationFee" | "monthlyFee" | "durationMonths">,
) {
  const monthly = `${formatMoney(option.monthlyFee)} a month for ${formatMonths(option.durationMonths)}`;
  return Number(option.registrationFee) > 0
    ? `${formatMoney(option.registrationFee)} to register, then ${monthly}`
    : `${monthly}, no registration fee`;
}

/** One checkbox card per skill the branch offers. */
export function SkillPicker({
  options,
  picked,
  onPickedChange,
  errors,
  emptyMessage,
}: {
  options: BranchSkillOption[];
  /** The ids of the ticked branch skills. */
  picked: string[];
  /** Takes an update function, like a state setter, so quick ticks don't overwrite each other. */
  onPickedChange: (update: (picked: string[]) => string[]) => void;
  errors?: string[];
  emptyMessage: string;
}) {
  const id = useId();

  return (
    <FieldSet data-invalid={errors?.length ? true : undefined}>
      <FieldLegend variant="label">Skills</FieldLegend>
      {options.length === 0 ? (
        <FieldDescription>{emptyMessage}</FieldDescription>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <FieldLabel key={option.id} htmlFor={`${id}-${option.id}`}>
              <Field orientation="horizontal">
                <Checkbox
                  id={`${id}-${option.id}`}
                  name="branchSkillIds"
                  value={option.id}
                  checked={picked.includes(option.id)}
                  onCheckedChange={(checked) =>
                    onPickedChange((current) =>
                      checked === true
                        ? [...current, option.id]
                        : current.filter((pickedId) => pickedId !== option.id),
                    )
                  }
                />
                <FieldContent>
                  <FieldTitle>{option.skillName}</FieldTitle>
                  <FieldDescription>
                    {option.teacherName}, {option.classroomName}. {feesText(option)}.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </div>
      )}
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </FieldSet>
  );
}

/**
 * A box to tick when the student pays the registration fees for the skills
 * being added straight away. Shows nothing when those skills have no fee.
 */
export function RegistrationFeePaidField({
  skills,
  description,
}: {
  skills: Pick<BranchSkillOption, "id" | "skillName" | "registrationFee">[];
  description: string;
}) {
  const id = useId();
  const withFee = skills.filter((skill) => Number(skill.registrationFee) > 0);
  if (withFee.length === 0) return null;

  // Added up in cents, so 10.10 + 15.20 doesn't come out as 25.299999.
  const totalCents = withFee.reduce(
    (sum, skill) => sum + Math.round(Number(skill.registrationFee) * 100),
    0,
  );
  const breakdown =
    withFee.length > 1
      ? `${withFee.map((skill) => `${skill.skillName} ${formatMoney(skill.registrationFee)}`).join(", ")}. `
      : "";

  return (
    // Keyed on the skills, so a tick given for one amount doesn't carry over
    // to a new amount after the skills change.
    <Field key={withFee.map((skill) => skill.id).join()} orientation="horizontal">
      <Checkbox id={id} name="registrationFeePaid" />
      <FieldContent>
        <FieldLabel htmlFor={id}>
          Registration {withFee.length > 1 ? "fees" : "fee"} paid: {formatMoney(totalCents / 100)}
        </FieldLabel>
        <FieldDescription>
          {breakdown}
          {description}
        </FieldDescription>
      </FieldContent>
    </Field>
  );
}

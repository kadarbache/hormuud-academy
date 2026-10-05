"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import type { AttendanceMark } from "@/generated/prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { countMarks, formatCounts, MARKS, markStyle } from "./labels";

export type SheetFormStudent = {
  enrollmentId: string;
  studentNumber: string;
  fullName: string;
  photoUrl: string | null;
};

/**
 * One day's sheet: a row per student with the four marks to pick from. A new
 * sheet starts with everyone Present, so taking it is tapping the ones who
 * aren't. Built for a phone first, with Save always in reach at the bottom.
 */
export function SheetForm({
  action,
  students,
  saved,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  students: (SheetFormStudent & { mark: AttendanceMark })[];
  /** Whether this day's sheet has been saved before. */
  saved: boolean;
}) {
  // Only what was tapped since the page loaded. Everything else shows the
  // saved mark, or Present, so a student added to the list since still has one.
  const [picked, setPicked] = useState<Record<string, AttendanceMark>>({});
  const { pending, formError, onSubmit } = useFormAction(action);
  const markOf = (student: (typeof students)[number]) => picked[student.enrollmentId] ?? student.mark;
  const counts = countMarks(students.map(markOf));

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {students.length} {students.length === 1 ? "student" : "students"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setPicked(Object.fromEntries(students.map((student) => [student.enrollmentId, "PRESENT"])))
          }
        >
          Everyone present
        </Button>
      </div>

      <ul className="divide-y rounded-lg border">
        {students.map((student) => {
          const mark = markOf(student);
          return (
            <li
              key={student.enrollmentId}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-8">
                  <AvatarImage src={student.photoUrl ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback>
                    <UserRound className="size-4 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-medium">{student.fullName}</div>
                  <div className="text-xs text-muted-foreground">{student.studentNumber}</div>
                </div>
              </div>

              <fieldset className="grid grid-cols-4 gap-1 sm:w-88 sm:shrink-0">
                <legend className="sr-only">{student.fullName}</legend>
                {MARKS.map((option) => (
                  <label key={option.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`mark.${student.enrollmentId}`}
                      value={option.value}
                      checked={mark === option.value}
                      onChange={() =>
                        setPicked((current) => ({ ...current, [student.enrollmentId]: option.value }))
                      }
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-9 items-center justify-center rounded-md border text-sm font-medium transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
                        mark === option.value
                          ? markStyle[option.value]
                          : "bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {option.label}
                    </span>
                  </label>
                ))}
              </fieldset>
            </li>
          );
        })}
      </ul>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background px-4 py-3 md:-mx-6 md:px-6">
        <p className="text-sm">{formatCounts(counts)}</p>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          {saved ? "Save changes" : "Save attendance"}
        </Button>
      </div>
    </form>
  );
}

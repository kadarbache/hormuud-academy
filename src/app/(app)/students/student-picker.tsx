"use client";

import { useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { searchStudents } from "./actions";
import type { StudentMatch } from "./types";

/** How long typing has to pause before the picker searches. */
const PAUSE_MS = 250;

/**
 * Finds a student by name, ID or phone, the same way the student list does,
 * and puts the one picked in the form as `name`, by student ID. Typing a
 * whole ID and not picking still sends it, so the server can check it;
 * anything else typed without picking is sent too, and the server asks for
 * a pick rather than quietly leaving the student out.
 */
export function StudentPicker({
  label = "Student",
  name = "student",
  description,
  errors,
}: {
  label?: string;
  name?: string;
  description?: React.ReactNode;
  errors?: string[];
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<StudentMatch[]>([]);
  const [searched, setSearched] = useState("");
  const [searching, setSearching] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [picked, setPicked] = useState<StudentMatch | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the latest search may fill the list, however the answers arrive.
  const latest = useRef(0);
  const invalid = Boolean(errors?.length);

  function search(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const ticket = ++latest.current;
    if (!value.trim()) {
      setMatches([]);
      setSearched("");
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const found = await searchStudents(value);
      if (ticket !== latest.current) return;
      setMatches(found);
      setSearched(value);
      setHighlighted(0);
      setSearching(false);
    }, PAUSE_MS);
  }

  function pick(student: StudentMatch) {
    setPicked(student);
    setQuery("");
    setMatches([]);
    setSearched("");
  }

  if (picked) {
    return (
      <Field data-invalid={invalid || undefined}>
        <FieldLabel>{label}</FieldLabel>
        <input type="hidden" name={name} value={picked.number} />
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <div className="min-w-0 text-sm">
            <div className="truncate font-medium">{picked.fullName}</div>
            <div className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{picked.number}</span> · {picked.branchName}
              {picked.phone && ` · ${picked.phone}`}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Change the student from ${picked.fullName}`}
            onClick={() => setPicked(null)}
          >
            <X />
          </Button>
        </div>
        <FieldError errors={errors?.map((message) => ({ message }))} />
      </Field>
    );
  }

  const open = query.trim() !== "" && (matches.length > 0 || searched === query);
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          name={name}
          value={query}
          onChange={(event) => search(event.target.value)}
          onKeyDown={(event) => {
            if (!open || matches.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlighted((index) => (index + 1) % matches.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlighted((index) => (index - 1 + matches.length) % matches.length);
            } else if (event.key === "Enter") {
              // Picks the student instead of sending the form.
              event.preventDefault();
              pick(matches[highlighted] ?? matches[0]);
            }
          }}
          placeholder="Name, ID or phone"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches.length > 0 ? `${listId}-${highlighted}` : undefined}
          aria-invalid={invalid || undefined}
        />
        {searching && (
          <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>
      {open && (
        <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto rounded-md border p-1">
          {matches.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              No student matches. Try part of the name, the ID or the phone number.
            </li>
          ) : (
            matches.map((student, index) => (
              <li
                key={student.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlighted}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-1.5 text-sm",
                  index === highlighted && "bg-accent text-accent-foreground",
                )}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => pick(student)}
              >
                <div className="font-medium">{student.fullName}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{student.number}</span> · {student.branchName}
                  {student.phone && ` · ${student.phone}`}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </Field>
  );
}

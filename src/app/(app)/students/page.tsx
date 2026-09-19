import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Banknote, CalendarClock, ChevronLeft, ChevronRight, UserPlus, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { formatStudentNumber } from "@/lib/format";
import { requireUser } from "@/lib/session";
import {
  countPastEnd,
  countUnpaidRegistrationFees,
  listStudents,
  PAGE_SIZE,
  readFilters,
  skillFilterOptions,
  type StudentFilters,
} from "./queries";

const warning = "border-amber-300 bg-amber-50 text-amber-900";

export const metadata: Metadata = { title: "Students" };

function pageHref(filters: StudentFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.skillId) params.set("skill", filters.skillId);
  if (filters.pastEnd) params.set("pastEnd", "1");
  if (filters.unpaid) params.set("unpaid", "1");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/students?${query}` : "/students";
}

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const user = await requireUser();
  const filters = readFilters(await searchParams);
  const [{ students, total, pageCount }, skills, pastEndCount, unpaidCount] = await Promise.all([
    listStudents(user, filters),
    skillFilterOptions(user),
    countPastEnd(user),
    countUnpaidRegistrationFees(user),
  ]);

  const filtered = Boolean(
    filters.q || filters.status !== "all" || filters.skillId || filters.pastEnd || filters.unpaid,
  );
  const firstShown = (filters.page - 1) * PAGE_SIZE + 1;

  return (
    <>
      <PageHeader
        title="Students"
        description={
          user.role === "admin"
            ? "Every student in the college."
            : "Students registered at your branch or taking a skill there. Search by ID or phone to find a student from another branch."
        }
      >
        <Button asChild>
          <Link href="/students/new">
            <UserPlus />
            Register student
          </Link>
        </Button>
      </PageHeader>

      {unpaidCount > 0 && !filters.unpaid && (
        <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm ${warning}`}>
          <Banknote className="size-4" />
          <span>
            {unpaidCount === 1
              ? "1 registration fee is unpaid."
              : `${unpaidCount} registration fees are unpaid.`}
          </span>
          <Link href="/students?unpaid=1" className="font-medium underline">
            Show those students
          </Link>
        </div>
      )}

      {pastEndCount > 0 && !filters.pastEnd && (
        <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm ${warning}`}>
          <CalendarClock className="size-4" />
          <span>
            {pastEndCount === 1
              ? "1 skill is past its end date and still marked Active."
              : `${pastEndCount} skills are past their end date and still marked Active.`}
          </span>
          <Link href="/students?pastEnd=1" className="font-medium underline">
            Show those students
          </Link>
        </div>
      )}

      {/* Keyed on the filters so "Clear" resets what the inputs show. */}
      <Form key={JSON.stringify(filters)} action="/students" className="flex flex-wrap items-end gap-3">
        <div className="grid w-full gap-1.5 sm:w-72">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Name, STU-00001 or phone" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" name="status" defaultValue={filters.status}>
            <NativeSelectOption value="all">All</NativeSelectOption>
            <NativeSelectOption value="active">Active</NativeSelectOption>
            <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="skill">Taking skill</Label>
          <NativeSelect id="skill" name="skill" defaultValue={filters.skillId}>
            <NativeSelectOption value="">Any skill</NativeSelectOption>
            {skills.map((skill) => (
              <NativeSelectOption key={skill.id} value={skill.id}>
                {skill.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex h-9 items-center gap-2">
          <Checkbox id="pastEnd" name="pastEnd" value="1" defaultChecked={filters.pastEnd} />
          <Label htmlFor="pastEnd" className="font-normal">
            Past end date
          </Label>
        </div>
        <div className="flex h-9 items-center gap-2">
          <Checkbox id="unpaid" name="unpaid" value="1" defaultChecked={filters.unpaid} />
          <Label htmlFor="unpaid" className="font-normal">
            Registration fee unpaid
          </Label>
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {filtered && (
          <Button variant="ghost" asChild>
            <Link href="/students">Clear</Link>
          </Button>
        )}
      </Form>

      {students.length === 0 ? (
        <EmptyRow
          message={filtered ? "No students match." : "No students yet. Register the first one."}
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Home branch</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <Link href={`/students/${student.id}`} className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={student.photoUrl ?? undefined} alt="" className="object-cover" />
                          <AvatarFallback>
                            <UserRound className="size-4 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium hover:underline">{student.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatStudentNumber(student.number)} · {student.sex === "MALE" ? "Male" : "Female"}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>{student.phone ?? "—"}</TableCell>
                    <TableCell>{student.homeBranchName}</TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {student.skills.length === 0 && <span className="text-muted-foreground">None active</span>}
                        {student.skills.map((skill) => (
                          <Badge
                            key={skill.name}
                            variant="outline"
                            className={skill.pastEnd ? warning : undefined}
                            title={skill.pastEnd ? "Past its end date" : undefined}
                          >
                            {skill.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {student.isActive ? (
                          <Badge variant="secondary">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                        {student.unpaidFees > 0 && (
                          <Badge variant="outline" className={warning}>
                            Fee unpaid
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {firstShown} to {firstShown + students.length - 1} of {total}
            </span>
            {pageCount > 1 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={pageHref(filters, filters.page - 1)}
                    aria-disabled={filters.page <= 1}
                    className={filters.page <= 1 ? "pointer-events-none opacity-50" : undefined}
                  >
                    <ChevronLeft />
                    Previous
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={pageHref(filters, filters.page + 1)}
                    aria-disabled={filters.page >= pageCount}
                    className={filters.page >= pageCount ? "pointer-events-none opacity-50" : undefined}
                  >
                    Next
                    <ChevronRight />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

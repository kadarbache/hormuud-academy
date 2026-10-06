import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/dates";
import { formatStudentNumber } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { requireStudent } from "@/lib/session";
import { Detail } from "../parts";
import { getPortalDetails } from "../queries";

export const metadata: Metadata = { title: "My details" };

/** The student's own record, read-only, and the way to a new password. */
export default async function MyDetailsPage() {
  const user = await requireStudent();
  const { student, isActive } = await getPortalDetails(user.studentId);

  return (
    <>
      <PageHeader
        title="My details"
        description="Something wrong? Ask at your branch to change it."
      />

      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={student.photoUrl ?? undefined} alt="" className="object-cover" />
              <AvatarFallback>
                <UserRound className="size-7 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <p className="text-lg font-semibold">{student.fullName}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono">{formatStudentNumber(student.number)}</span>
                {isActive ? (
                  <Badge variant="secondary">Active</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Detail label="Sex">{student.sex === "MALE" ? "Male" : "Female"}</Detail>
            <Detail label="Home branch">{student.homeBranch.name}</Detail>
            <Detail label="Registered">{formatDate(student.registrationDate)}</Detail>
            <Detail label="Phone">{formatPhone(student.phone) || "Not given"}</Detail>
            <Detail label="Responsible person's phone">
              {formatPhone(student.responsiblePhone) || "Not given"}
            </Detail>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            You sign in with {formatStudentNumber(student.number)} and your password. Forgot it?
            Your branch can give you a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Card content is a column, which would stretch the button across it. */}
          <Button variant="outline" asChild className="self-start">
            <Link href="/portal/password">
              <KeyRound />
              Change password
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

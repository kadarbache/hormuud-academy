import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordForm } from "@/components/password-form";
import { formatTeacherNumber } from "@/lib/format";
import { hasPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/session";
import { TEACHER_PASSWORD_MIN } from "@/lib/teacher-logins";
import { changeTeacherPassword } from "./actions";

export const metadata: Metadata = { title: "Password" };

export default async function TeacherPasswordPage() {
  const user = await requireTeacher({ onTemporaryPassword: true });
  const [teacher, withPassword] = await Promise.all([
    prisma.teacher.findUniqueOrThrow({
      where: { id: user.teacherId },
      select: { number: true },
    }),
    hasPassword(user.id),
  ]);
  const teacherId = formatTeacherNumber(teacher.number);
  const first = user.mustChangePassword;

  if (!withPassword) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            You sign in with Google, so you have no password here. If you&apos;d like to sign in
            with your Teacher ID, {teacherId}, ask the admin for a password.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{first ? "Choose your password" : "Change password"}</CardTitle>
        <CardDescription>
          {first
            ? `The password from the admin was only for signing in this once. Choose one of your own that nobody else knows. You sign in with ${teacherId} and this password.`
            : `You sign in with ${teacherId} and this password. You'll be logged out on any other phone or computer you're signed in on.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PasswordForm
          action={changeTeacherPassword}
          askCurrent={!first}
          minLength={TEACHER_PASSWORD_MIN}
          home="/attendance"
        />
      </CardContent>
    </Card>
  );
}

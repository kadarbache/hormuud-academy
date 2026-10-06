import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/action-button";
import type { StudentLoginAction } from "@/generated/prisma/client";
import { formatDateTime } from "@/lib/dates";
import { createLogin, resetLoginPassword, setLoginActive } from "../login-actions";
import type { getStudentLogin } from "../queries";
import { IssuePasswordButton } from "./student-login";

const actionLabel: Record<StudentLoginAction, string> = {
  CREATED: "Login created",
  PASSWORD_RESET: "New password given",
  TURNED_OFF: "Turned off",
  TURNED_ON: "Turned back on",
};

/** The student's login to the portal, on their page, for staff who may manage it. */
export function PortalLogin({
  studentId,
  studentNumber,
  data,
}: {
  studentId: string;
  studentNumber: string;
  data: NonNullable<Awaited<ReturnType<typeof getStudentLogin>>>;
}) {
  const { login, events } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal login</CardTitle>
        <CardDescription>
          {login
            ? `Signs in with ${studentNumber} to see their skills, fees and attendance.`
            : "No login yet. With one, the student can see their own skills, fees and attendance on their phone."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {login && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {login.on ? (
              <Badge variant="secondary">On</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Off
              </Badge>
            )}
            <span className="text-muted-foreground">
              {login.mustChangePassword
                ? "Still on the temporary password: they haven't signed in yet."
                : "They've signed in and chosen their own password."}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!login ? (
            <IssuePasswordButton
              action={createLogin.bind(null, studentId)}
              studentNumber={studentNumber}
              label="Create login"
              title={`Create a login for ${studentNumber}?`}
              description="You'll see a temporary password once. Give it to the student; they choose their own the first time they sign in."
              confirmLabel="Create login"
            />
          ) : login.on ? (
            <>
              <IssuePasswordButton
                action={resetLoginPassword.bind(null, studentId)}
                studentNumber={studentNumber}
                label="Reset password"
                variant="outline"
                title="Give the student a new password?"
                description="Their old password stops working and they're logged out on every phone. You'll see a temporary password once to give them."
                confirmLabel="Reset password"
              />
              <ActionButton
                variant="ghost"
                size="sm"
                className="text-destructive"
                action={setLoginActive.bind(null, studentId, false)}
                confirm={{
                  title: "Turn this login off?",
                  description:
                    "The student is logged out and can't sign in until staff turn it back on. Nothing in their record changes.",
                  confirmLabel: "Turn off",
                  destructive: true,
                }}
              >
                Turn off
              </ActionButton>
            </>
          ) : (
            <ActionButton
              variant="outline"
              size="sm"
              action={setLoginActive.bind(null, studentId, true)}
            >
              Turn back on
            </ActionButton>
          )}
        </div>

        {events.length > 0 && (
          <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
            {events.map((event) => (
              <li key={event.id}>
                <span className="text-foreground">{actionLabel[event.action]}</span> by{" "}
                {event.by.name}
                {event.branch && ` at ${event.branch.name}`}, {formatDateTime(event.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

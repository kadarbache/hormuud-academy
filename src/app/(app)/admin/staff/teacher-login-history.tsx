import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { TeacherLoginAction } from "@/generated/prisma/client";
import { formatDateTime } from "@/lib/dates";

const actionLabel: Record<TeacherLoginAction, string> = {
  PASSWORD_GIVEN: "Password given",
  PASSWORD_RESET: "New password given",
  PASSWORD_REMOVED: "Password taken away",
  PASSWORD_CHANGED: "Chose their own password",
  SIGNED_IN_WITH_PASSWORD: "Signed in with Teacher ID and password",
  SIGNED_IN_WITH_GOOGLE: "Signed in with Google",
};

export type TeacherLoginEventRow = {
  id: string;
  action: TeacherLoginAction;
  ipAddress: string | null;
  createdAt: Date;
  by: { id: string; name: string };
};

/**
 * A teacher login's recent sign-ins and password changes, newest first, so
 * an attendance change that looks wrong can be traced to how they got in.
 */
export function TeacherLoginHistory({
  name,
  loginId,
  events,
}: {
  name: string;
  /** The teacher's login, so the admin's own changes can be told apart. */
  loginId: string;
  events: TeacherLoginEventRow[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          History
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{name}&apos;s sign-ins</DialogTitle>
          <DialogDescription>
            Sign-ins and password changes, newest first, up to the last 30.
          </DialogDescription>
        </DialogHeader>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {events.map((event) => (
              <li key={event.id}>
                <span className="font-medium">{actionLabel[event.action]}</span>
                {event.by.id !== loginId && ` by ${event.by.name}`}
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(event.createdAt)}
                  {event.ipAddress && `, from ${event.ipAddress}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

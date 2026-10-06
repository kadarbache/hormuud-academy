import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { AppShell } from "../(app)/app-shell";

export const metadata: Metadata = { title: { default: "Portal", template: "%s · Hormuud Academy" } };

/**
 * The student's side of the app, in the same frame as a teacher's: the
 * sidebar with their own menu, and the header. Every page here shows the
 * signed-in student's own record and nobody else's.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Pages send a student still on a temporary password to choose their own;
  // until then the menu is hidden, since every page would only send them back.
  const user = await requireStudent({ onTemporaryPassword: true });
  // The name on the student's record, which staff keep up to date, rather
  // than the one copied onto the login when it was made.
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: user.studentId },
    select: { fullName: true, homeBranch: { select: { name: true } } },
  });

  return (
    <AppShell
      user={{
        name: student.fullName,
        email: user.email,
        role: user.role,
        place: student.homeBranch.name,
        locked: user.mustChangePassword,
      }}
    >
      {children}
    </AppShell>
  );
}

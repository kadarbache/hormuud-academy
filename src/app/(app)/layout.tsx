import { prisma } from "@/lib/prisma";
import { requireSignedIn } from "@/lib/session";
import { AppShell } from "./app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSignedIn();
  const branch =
    user.role === "staff" && user.branchId
      ? await prisma.branch.findUnique({
          where: { id: user.branchId },
          select: { name: true },
        })
      : null;
  // A teacher works wherever they teach, which can be more than one branch.
  const teacherBranches =
    user.role === "teacher"
      ? await prisma.branch.findMany({
          where: { teachers: { some: { teacherId: user.teacherId } } },
          orderBy: { name: "asc" },
          select: { name: true },
        })
      : [];
  const place =
    user.role === "admin"
      ? "All branches"
      : user.role === "teacher"
        ? teacherBranches.map((b) => b.name).join(", ")
        : (branch?.name ?? "No branch");

  // A staff account with no branch can't see or register anyone. It only
  // happens if the admin's setup is incomplete, so say so plainly.
  const missingBranch = user.role === "staff" && !branch;

  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role, place }}>
      {missingBranch ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Your account isn&apos;t linked to a branch yet. Ask the admin to set your branch.
        </div>
      ) : (
        children
      )}
    </AppShell>
  );
}

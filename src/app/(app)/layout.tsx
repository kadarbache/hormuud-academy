import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { prisma } from "@/lib/prisma";
import { requireSignedIn } from "@/lib/session";
import { AppSidebar } from "./app-sidebar";

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
    <SidebarProvider>
      <AppSidebar
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
          place,
        }}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="truncate text-sm text-muted-foreground">{place}</span>
          <ThemeToggle className="ml-auto" />
        </header>
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {missingBranch ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Your account isn&apos;t linked to a branch yet. Ask the admin to set your branch.
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

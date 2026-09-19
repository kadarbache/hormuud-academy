import { requireAdmin } from "@/lib/session";

// Every page under /admin is for admins only. Each action checks again,
// because a server action can be called without loading the page.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type Role = "admin" | "staff";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** The branch a staff member works at. Always null for admins. */
  branchId: string | null;
};

/** The signed-in user, or null. Cached for the length of one request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { user } = session;
  const role: Role = user.role === "admin" ? "admin" : "staff";
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    branchId: role === "admin" ? null : (user.branchId ?? null),
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/students");
  return user;
}

export function isAdmin(user: CurrentUser) {
  return user.role === "admin";
}

import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type Role = "admin" | "staff" | "teacher";

type Account = { id: string; name: string; email: string };

/** A staff account: the admin, or branch staff at one branch. */
export type StaffUser = Account & {
  role: "admin" | "staff";
  /** The branch a staff member works at. Always null for admins. */
  branchId: string | null;
};

/** A teacher's login. It sees that teacher's own class times and pay, nothing else. */
export type TeacherUser = Account & {
  role: "teacher";
  teacherId: string;
};

export type CurrentUser = StaffUser | TeacherUser;

/**
 * The signed-in user, or null. Cached for the length of one request. An
 * account with a role the app doesn't know gets nothing, rather than being
 * taken for branch staff.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { id, name, email, role, branchId, teacherId } = session.user;
  if (role === "admin") return { id, name, email, role, branchId: null };
  if (role === "staff") return { id, name, email, role, branchId: branchId ?? null };
  if (role === "teacher" && teacherId) return { id, name, email, role, teacherId };
  return null;
});

/** Where someone lands after logging in, and where a page they can't open sends them. */
export function homeOf(user: CurrentUser) {
  return user.role === "teacher" ? "/attendance" : "/students";
}

/** Anyone logged in: staff or a teacher. Each page then shows them their own part. */
export async function requireSignedIn(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The admin or branch staff. A teacher who opens a staff page, from an old
 * link or by typing the address, goes to their own attendance instead.
 */
export async function requireStaff(): Promise<StaffUser> {
  const user = await requireSignedIn();
  if (user.role === "teacher") redirect(homeOf(user));
  return user;
}

/** Branch staff get the "Admins only" page from (app)/forbidden.tsx. */
export async function requireAdmin(): Promise<StaffUser> {
  const user = await requireStaff();
  if (user.role !== "admin") forbidden();
  return user;
}

/** A teacher's login. Staff have their own pages and are sent there. */
export async function requireTeacher(): Promise<TeacherUser> {
  const user = await requireSignedIn();
  if (user.role !== "teacher") redirect(homeOf(user));
  return user;
}

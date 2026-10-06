import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type Role = "admin" | "staff" | "teacher" | "student";

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
  /** Still on the temporary password the admin gave them. */
  mustChangePassword: boolean;
};

/** A student's login. It sees that student's own record in the portal, nothing else. */
export type StudentUser = Account & {
  role: "student";
  studentId: string;
  /** Still on the temporary password staff gave them. */
  mustChangePassword: boolean;
};

/** Everyone who uses the staff side of the app: staff and teachers. */
export type AppUser = StaffUser | TeacherUser;

export type CurrentUser = AppUser | StudentUser;

/**
 * The signed-in user, or null. Cached for the length of one request. An
 * account with a role the app doesn't know gets nothing, rather than being
 * taken for branch staff.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { id, name, email, role, branchId, teacherId, studentId, mustChangePassword } =
    session.user;
  if (role === "admin") return { id, name, email, role, branchId: null };
  if (role === "staff") return { id, name, email, role, branchId: branchId ?? null };
  if (role === "teacher" && teacherId) {
    return { id, name, email, role, teacherId, mustChangePassword: Boolean(mustChangePassword) };
  }
  if (role === "student" && studentId) {
    return { id, name, email, role, studentId, mustChangePassword: Boolean(mustChangePassword) };
  }
  return null;
});

/** Where a teacher or a student chooses their own password. */
function passwordPage(user: TeacherUser | StudentUser) {
  return user.role === "student" ? "/portal/password" : "/password";
}

/** Where someone lands after logging in, and where a page they can't open sends them. */
export function homeOf(user: CurrentUser) {
  if (user.role === "student") return "/portal";
  return user.role === "teacher" ? "/attendance" : "/students";
}

/**
 * Anyone on the staff side: staff or a teacher. Each page then shows them
 * their own part. A student who opens one goes to the portal instead, and a
 * teacher still on a temporary password goes to choose their own first,
 * unless this is where they choose it.
 */
export async function requireSignedIn(
  { onTemporaryPassword = false }: { onTemporaryPassword?: boolean } = {},
): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "student") redirect(homeOf(user));
  if (user.role === "teacher" && user.mustChangePassword && !onTemporaryPassword) {
    redirect(passwordPage(user));
  }
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
export async function requireTeacher(
  options: { onTemporaryPassword?: boolean } = {},
): Promise<TeacherUser> {
  const user = await requireSignedIn(options);
  if (user.role !== "teacher") redirect(homeOf(user));
  return user;
}

/**
 * A student's login. Staff and teachers are sent to their own side. A student
 * still on a temporary password goes to choose their own first, unless this
 * is where they choose it.
 */
export async function requireStudent(
  { onTemporaryPassword = false }: { onTemporaryPassword?: boolean } = {},
): Promise<StudentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect(homeOf(user));
  if (user.mustChangePassword && !onTemporaryPassword) redirect(passwordPage(user));
  return user;
}

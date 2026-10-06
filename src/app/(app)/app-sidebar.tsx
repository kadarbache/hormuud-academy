"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  CalendarRange,
  ChartNoAxesColumn,
  ClipboardCheck,
  DoorOpen,
  GraduationCap,
  HandCoins,
  HandHelping,
  KeyRound,
  Library,
  LogOut,
  Presentation,
  Receipt,
  Settings,
  Tag,
  Tags,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Role } from "@/lib/session";
import { signOut } from "./actions";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType;
  /** Returns true when this item is the page being shown. */
  match: (pathname: string) => boolean;
};

const under = (href: string) => (pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const studentItems: NavItem[] = [
  {
    href: "/students",
    label: "Students",
    icon: Users,
    match: (pathname) => under("/students")(pathname) && pathname !== "/students/new",
  },
  {
    href: "/students/new",
    label: "Register student",
    icon: UserPlus,
    match: (pathname) => pathname === "/students/new",
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: ClipboardCheck,
    match: under("/attendance"),
  },
];

// Everyone can open these. Admins manage every branch's; branch staff see
// their own branch's, read-only.
const teachersItem: NavItem = {
  href: "/teachers",
  label: "Teachers",
  icon: Presentation,
  match: under("/teachers"),
};
const classesItem: NavItem = {
  href: "/classes",
  label: "Classes",
  icon: DoorOpen,
  match: under("/classes"),
};

// Branch staff take money at the counter, so they record and read their own
// branch's income. Expenses, teacher pay and budgets are the admin's alone.
const incomeItem: NavItem = {
  href: "/finance/income",
  label: "Income",
  icon: Wallet,
  match: under("/finance/income"),
};

const owedItem: NavItem = {
  href: "/finance/owed",
  label: "Fees owed",
  icon: HandHelping,
  match: under("/finance/owed"),
};

// The admin keeps the list and the prices; branch staff sell from their own
// shelf and keep its count.
const booksItem: NavItem = {
  href: "/books",
  label: "Books",
  icon: Library,
  match: under("/books"),
};

const branchItems: NavItem[] = [incomeItem, owedItem, booksItem, teachersItem, classesItem];

const financeItems: NavItem[] = [
  {
    href: "/finance",
    label: "Dashboard",
    icon: ChartNoAxesColumn,
    match: (pathname) => pathname === "/finance",
  },
  incomeItem,
  owedItem,
  { href: "/finance/expenses", label: "Expenses", icon: Receipt, match: under("/finance/expenses") },
  {
    href: "/finance/expense-categories",
    label: "Expense categories",
    icon: Tag,
    match: under("/finance/expense-categories"),
  },
  {
    href: "/finance/teacher-pay",
    label: "Teacher pay",
    icon: HandCoins,
    match: under("/finance/teacher-pay"),
  },
  {
    href: "/finance/budget",
    label: "Monthly budget",
    icon: CalendarRange,
    match: under("/finance/budget"),
  },
];

// A teacher's login: their own class times' attendance and their own pay.
const teacherItems: NavItem[] = [
  {
    href: "/attendance",
    label: "Attendance",
    icon: ClipboardCheck,
    match: (pathname) => under("/attendance")(pathname) || under("/class-times")(pathname),
  },
  { href: "/my-pay", label: "My pay", icon: HandCoins, match: under("/my-pay") },
];

const adminItems: NavItem[] = [
  { href: "/admin/branches", label: "Branches", icon: Building2, match: under("/admin/branches") },
  { href: "/admin/skills", label: "Skills", icon: BookOpen, match: under("/admin/skills") },
  { href: "/admin/categories", label: "Categories", icon: Tags, match: under("/admin/categories") },
  booksItem,
  teachersItem,
  classesItem,
  { href: "/admin/staff", label: "Staff accounts", icon: KeyRound, match: under("/admin/staff") },
  { href: "/admin/settings", label: "Settings", icon: Settings, match: under("/admin/settings") },
];

function NavMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  // On a phone the menu slides over the page, so close it once a page is
  // picked. On a computer it stays put and this does nothing.
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton asChild isActive={item.match(pathname)}>
            <Link href={item.href} onClick={() => setOpenMobile(false)}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar({
  user,
}: {
  /** `place` is where they work: all branches, their branch, or a teacher's branches. */
  user: { name: string; email: string; role: Role; place: string };
}) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="size-4" />
          </div>
          <span className="font-semibold">Hormuud Academy</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {user.role === "teacher" ? (
          <SidebarGroup>
            <SidebarGroupLabel>Teaching</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavMenu items={teacherItems} pathname={pathname} />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Students</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavMenu items={studentItems} pathname={pathname} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {user.role === "teacher" ? null : user.role === "admin" ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Money</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavMenu items={financeItems} pathname={pathname} />
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavMenu items={adminItems} pathname={pathname} />
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Your branch</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavMenu items={branchItems} pathname={pathname} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1.5 text-sm">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user.role === "admin"
              ? "Admin, all branches"
              : user.role === "teacher"
                ? `Teacher, ${user.place}`
                : `Staff, ${user.place}`}
          </p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton type="submit">
                <LogOut />
                <span>Log out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

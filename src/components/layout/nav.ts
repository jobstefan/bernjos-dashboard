import type { Role } from "@/lib/types/payroll";

export interface NavItem {
  label: string;
  href: string;
  /** Lucide icon name resolved in the sidebar. */
  icon:
    | "dashboard"
    | "payroll"
    | "employees"
    | "payslip"
    | "cashAdvance"
    | "schedule"
    | "branch"
    | "savings"
    | "attendance";
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: "dashboard",
    roles: ["super_admin", "admin", "manager", "employee"],
  },
  {
    label: "Payroll",
    href: "/payroll",
    icon: "payroll",
    roles: ["super_admin", "admin", "manager"],
  },
  {
    label: "My Payslips",
    href: "/payroll/payslips",
    icon: "payslip",
    roles: ["employee"],
  },
  {
    label: "Schedule",
    href: "/schedule",
    icon: "schedule",
    roles: ["super_admin", "admin", "manager"],
  },
  {
    label: "My Schedule",
    href: "/schedule/mine",
    icon: "schedule",
    roles: ["employee"],
  },
  {
    label: "Attendance",
    href: "/attendance",
    icon: "attendance",
    roles: ["super_admin", "admin"],
  },
  {
    label: "Branches",
    href: "/branches",
    icon: "branch",
    roles: ["super_admin", "admin"],
  },
  {
    label: "Cash Advances",
    href: "/cash-advances",
    icon: "cashAdvance",
    roles: ["super_admin", "admin", "manager"],
  },
  {
    label: "My Advances",
    href: "/cash-advances/mine",
    icon: "cashAdvance",
    roles: ["employee"],
  },
  {
    label: "Savings",
    href: "/savings",
    icon: "savings",
    roles: ["super_admin", "admin"],
  },
  {
    label: "My Savings",
    href: "/savings/mine",
    icon: "savings",
    roles: ["manager", "employee"],
  },
  {
    label: "Employees",
    href: "/employees",
    icon: "employees",
    roles: ["super_admin", "admin", "manager"],
  },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "employee":
      return "Employee";
  }
}

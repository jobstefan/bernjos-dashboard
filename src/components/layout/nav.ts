import type { Role } from "@/lib/types/payroll";

export type NavIcon =
  | "dashboard"
  | "payroll"
  | "employees"
  | "payslip"
  | "cashAdvance"
  | "charge"
  | "schedule"
  | "branch"
  | "department"
  | "savings"
  | "attendance"
  | "settings";

export interface NavItem {
  label: string;
  href: string;
  /** Lucide icon name resolved in the sidebar. */
  icon: NavIcon;
  roles: Role[];
}

export interface NavGroup {
  /** Section label; `null` renders the items ungrouped (e.g. Overview). */
  label: string | null;
  items: NavItem[];
}

const ALL: Role[] = ["super_admin", "admin", "manager", "employee"];
const MGRS: Role[] = ["super_admin", "admin", "manager"];
const ADMINS: Role[] = ["super_admin", "admin"];

/** Navigation grouped by domain. Role filtering is applied per item. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ label: "Dashboard", href: "/", icon: "dashboard", roles: ALL }],
  },
  {
    label: "Payroll",
    items: [
      { label: "Payroll", href: "/payroll", icon: "payroll", roles: MGRS },
      {
        label: "My Payslips",
        href: "/payroll/payslips",
        icon: "payslip",
        roles: ["employee"],
      },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Employees", href: "/employees", icon: "employees", roles: MGRS },
      {
        label: "Departments",
        href: "/departments",
        icon: "department",
        roles: ADMINS,
      },
      { label: "Branches", href: "/branches", icon: "branch", roles: ADMINS },
    ],
  },
  {
    label: "Time",
    items: [
      { label: "Schedule", href: "/schedule", icon: "schedule", roles: MGRS },
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
        roles: ADMINS,
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Cash Advances",
        href: "/cash-advances",
        icon: "cashAdvance",
        roles: MGRS,
      },
      {
        label: "Charges",
        href: "/charges",
        icon: "charge",
        roles: ADMINS,
      },
      {
        label: "My Advances",
        href: "/cash-advances/mine",
        icon: "cashAdvance",
        roles: ["employee"],
      },
      { label: "Loans & Savings", href: "/savings", icon: "savings", roles: ADMINS },
      {
        label: "My Loans & Savings",
        href: "/savings/mine",
        icon: "savings",
        roles: ["manager", "employee"],
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        label: "Settings",
        href: "/settings/users",
        icon: "settings",
        roles: ["super_admin"],
      },
    ],
  },
];

/** Flat list of every nav item (used by the command palette and search). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Groups with their items filtered by role; empty groups are dropped. */
export function navGroupsForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
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

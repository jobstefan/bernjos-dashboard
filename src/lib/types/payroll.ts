import type {
  EmployeeModel,
  PayrollPeriodModel,
  PayrollRunItemModel,
} from "@/generated/prisma/models";
import type {
  EmploymentStatus,
  EmploymentType,
  PayFrequency,
  PayrollStatus,
  RunItemStatus,
  TaxStatus,
} from "@/generated/prisma/enums";

// Re-export Prisma model + enum types under friendly names for the app layer.
export type Employee = EmployeeModel;
export type PayrollPeriod = PayrollPeriodModel;
export type PayrollRunItem = PayrollRunItemModel;
export type {
  EmploymentStatus,
  EmploymentType,
  PayFrequency,
  PayrollStatus,
  RunItemStatus,
  TaxStatus,
};

/** The four payroll roles, read from Clerk `publicMetadata.role`. */
export type Role = "super_admin" | "admin" | "manager" | "employee";

/** The signed-in actor, resolved from Clerk for RBAC + audit. */
export interface Actor {
  clerkUserId: string;
  email: string | null;
  role: Role;
}

/**
 * Full, auditable breakdown of one employee's statutory deductions for a period.
 * All money values are plain numbers rounded to 2 dp (peso).
 */
export interface DeductionBreakdown {
  employeeId: string;
  periodId: string;
  frequency: PayFrequency;
  basicSalary: number;
  /** Gross for this cut-off (monthly salary, halved for semi-monthly). */
  grossPay: number;
  sssEmployee: number;
  sssEmployer: number;
  philhealthEmployee: number;
  philhealthEmployer: number;
  pagibigEmployee: number;
  pagibigEmployer: number;
  taxableIncome: number;
  birWithholding: number;
  totalDeductions: number;
  netPay: number;
  /** IDs of the exact statutory rows used, for auditability. */
  brackets: {
    sssBracketId: string;
    philhealthBracketId: string;
    pagibigRateId: string;
    birBracketId: string;
  };
}

export interface CreatePeriodInput {
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  frequency: PayFrequency;
  notes?: string | null;
}

export interface PayrollRunResult {
  periodId: string;
  itemCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
}

export interface PeriodFilters {
  status?: PayrollStatus;
}

export interface EmployeeFilters {
  search?: string;
  department?: string;
  employmentStatus?: EmploymentStatus;
  employmentType?: EmploymentType;
}

/** A single employee's payslip for one period (run item joined to context). */
export interface Payslip {
  runItemId: string;
  period: {
    id: string;
    label: string;
    periodStart: Date;
    periodEnd: Date;
    payDate: Date;
    frequency: PayFrequency;
    status: PayrollStatus;
  };
  employee: {
    id: string;
    employeeCode: string;
    fullName: string;
    position: string;
    department: string;
    tin: string | null;
  };
  basicSalary: number;
  grossPay: number;
  sssEmployee: number;
  philhealthEmployee: number;
  pagibigEmployee: number;
  birWithholding: number;
  otherDeductions: number;
  otherEarnings: number;
  totalDeductions: number;
  netPay: number;
  status: RunItemStatus;
}

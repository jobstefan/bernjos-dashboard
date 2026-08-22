import type {
  CashAdvanceModel,
  EmployeeModel,
  PayrollPeriodModel,
  PayrollRunItemModel,
} from "@/generated/prisma/models";
import type {
  CashAdvanceStatus,
  EmploymentStatus,
  PayFrequency,
  PayrollStatus,
  RunItemStatus,
} from "@/generated/prisma/enums";

// Re-export Prisma model + enum types under friendly names for the app layer.
export type Employee = EmployeeModel;
export type PayrollPeriod = PayrollPeriodModel;
export type PayrollRunItem = PayrollRunItemModel;
export type CashAdvance = CashAdvanceModel;
export type {
  CashAdvanceStatus,
  EmploymentStatus,
  PayFrequency,
  PayrollStatus,
  RunItemStatus,
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
  /** Daily basic-pay rate. */
  basicSalary: number;
  /** Days worked in the period (from attendance, else the per-frequency default). */
  daysWorked: number;
  /** Gross for this period (daily rate × days worked). */
  grossPay: number;
  /** True when days worked came from the employee's schedule + attendance. */
  attendanceTracked: boolean;
  /** Scheduled days with no attendance record (0 when not tracked). */
  absentDays: number;
  /** Deductible late minutes from the first minute, summed (0 when not tracked). */
  lateMinutes: number;
  /** Early-out minutes, summed (0 when not tracked). */
  undertimeMinutes: number;
  /** Peso deduction for late+undertime (pro-rated daily rate; 0 when not tracked). */
  lateDeduction: number;
  sssEmployee: number;
  sssEmployer: number;
  philhealthEmployee: number;
  philhealthEmployer: number;
  totalDeductions: number;
  netPay: number;
  /** IDs of the exact statutory rows used, for auditability. */
  brackets: {
    sssBracketId: string;
    philhealthBracketId: string;
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
  };
  basicSalary: number;
  grossPay: number;
  sssEmployee: number;
  philhealthEmployee: number;
  otherDeductions: number;
  otherEarnings: number;
  /** Employee savings withheld into their account — not a deduction. */
  savingsContribution: number;
  totalDeductions: number;
  netPay: number;
  status: RunItemStatus;
  /** Admin-authored remark shown on the payslip (null when none). */
  remarks: string | null;
}

export interface CashAdvanceFilters {
  status?: CashAdvanceStatus;
  employeeId?: string;
}

/** A cash-advance request flattened for display in a table. */
export interface CashAdvanceRow {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  amount: number;
  reason: string;
  status: CashAdvanceStatus;
  decisionNote: string | null;
  appliedPeriodLabel: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

import type {
  CashAdvanceModel,
  ChargeModel,
  UserProfileModel,
  PayrollPeriodModel,
  PayrollRunItemModel,
} from "@/generated/prisma/models";
import type {
  CashAdvanceStatus,
  ChargeStatus,
  EmploymentStatus,
  PayFrequency,
  PayrollStatus,
  RunItemStatus,
} from "@/generated/prisma/enums";

// Re-export Prisma model + enum types under friendly names for the app layer.
export type UserProfile = UserProfileModel;
/** @deprecated use UserProfile */
export type Employee = UserProfile;
export type PayrollPeriod = PayrollPeriodModel;
export type PayrollRunItem = PayrollRunItemModel;
export type CashAdvance = CashAdvanceModel;
export type Charge = ChargeModel;
export type {
  CashAdvanceStatus,
  ChargeStatus,
  EmploymentStatus,
  PayFrequency,
  PayrollStatus,
  RunItemStatus,
};

/** The four payroll roles stored in the DB User table. */
export type Role = "super_admin" | "admin" | "manager" | "employee";

/** The signed-in actor, resolved from Clerk + DB for RBAC + audit. */
export interface Actor {
  clerkUserId: string;
  email: string | null;
  role: Role;
}

/**
 * Full, auditable breakdown of one profile's statutory deductions for a period.
 * All money values are plain numbers rounded to 2 dp (peso).
 */
export interface DeductionBreakdown {
  profileId: string;
  periodId: string;
  frequency: PayFrequency;
  /** Daily basic-pay rate. */
  basicSalary: number;
  /** Days worked in the period (from attendance, else the per-frequency default). */
  daysWorked: number;
  /** Gross for this period (daily rate × days worked). */
  grossPay: number;
  /** True when days worked came from the profile's schedule + attendance. */
  attendanceTracked: boolean;
  /** Scheduled days with no attendance record (0 when not tracked). */
  absentDays: number;
  /** Deductible late minutes from the first minute, summed (0 when not tracked). */
  lateMinutes: number;
  /** Early-out minutes, summed (0 when not tracked). */
  undertimeMinutes: number;
  /** Peso deduction for late+undertime (pro-rated daily rate; 0 when not tracked). */
  lateDeduction: number;
  /** Minutes worked past scheduled end, summed (0 when not tracked). */
  overtimeMinutes: number;
  /** Peso earnings for overtime at 1× hourly rate (0 when not tracked). */
  overtimeEarnings: number;
  /**
   * Days worked grouped by branch, so net pay can be split proportionally per branch
   * once it's known. Empty when not attendance-tracked. A null `branchId` buckets
   * days whose branch couldn't be resolved.
   */
  branchBreakdown: { branchId: string | null; daysWorked: number }[];
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

export interface ProfileFilters {
  search?: string;
  department?: string;
  employmentStatus?: EmploymentStatus;
}

/** @deprecated use ProfileFilters */
export type EmployeeFilters = ProfileFilters;

/** A single profile's payslip for one period (run item joined to context). */
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
  lateDeduction: number;
  advanceDeduction: number;
  otherDeductions: number;
  loanDeduction: number;
  chargeDeduction: number;
  otherEarnings: number;
  incentiveEarnings: number;
  /** Minutes worked past scheduled end for the period (0 when none or not tracked). */
  overtimeMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  /** User savings withheld into their account — not a deduction. */
  savingsContribution: number;
  totalDeductions: number;
  netPay: number;
  status: RunItemStatus;
  /** Admin-authored remark shown on the payslip (null when none). */
  remarks: string | null;
  /** Net pay attributed to each branch the profile worked at (empty when none). */
  branchBreakdown: BranchNetLine[];
  /** Days actually worked per attendance (0 when not attendance-tracked or old data). */
  daysWorked?: number;
  /** Scheduled days with no attendance record (0 when not tracked). */
  absentDays?: number;
  /** Calendar days in the period minus scheduled days (0 when not tracked). */
  dayOffDays?: number;
}

/** One branch's share of a profile's period net (net × its day-share). */
export interface BranchNetLine {
  branchName: string;
  daysWorked: number;
  netPay: number;
}

export interface CashAdvanceFilters {
  status?: CashAdvanceStatus;
  profileId?: string;
}

/** An incentive flattened for display in a table. */
export type IncentiveStatus = "pending" | "applied" | "cancelled";

export interface IncentiveRow {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string | null;
  branchName: string | null;
  amount: number;
  reason: string | null;
  status: IncentiveStatus;
  appliedPeriodLabel: string | null;
  createdAt: string;
  cancelledAt: string | null;
}

/** A charge flattened for display in a table. */
export interface ChargeRow {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  amount: number;
  reason: string;
  status: ChargeStatus;
  appliedPeriodLabel: string | null;
  createdAt: string;
}

/** A cash-advance request flattened for display in a table. */
export interface CashAdvanceRow {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string | null;
  branchName: string | null;
  amount: number;
  approvedAmount: number | null;
  reason: string;
  status: CashAdvanceStatus;
  decisionNote: string | null;
  appliedPeriodLabel: string | null;
  requestedAt: string;
  decidedAt: string | null;
}


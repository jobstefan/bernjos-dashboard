export type LoanStatus = "pending" | "approved" | "active" | "completed" | "cancelled";
export type LoanRepaymentStatus = "pending" | "applied";

export interface LoanRepaymentRow {
  id: string;
  installmentNo: number;
  amount: number;
  status: LoanRepaymentStatus;
  appliedPeriodLabel: string | null;
  createdAt: string;
}

/** A loan flattened for display in tables. */
export interface LoanRow {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string | null;
  branchName: string | null;
  amount: number;
  termPeriods: number;
  installmentAmount: number;
  reason: string;
  status: LoanStatus;
  decisionNote: string | null;
  disbursedAt: string | null;
  requestedAt: string;
  decidedAt: string | null;
  totalRepaid: number;
  outstandingBalance: number;
  repayments: LoanRepaymentRow[];
  deletionRequestedAt: string | null;
  deletionRequestedBy: string | null;
}

/** Self-service view: employee's loans + how much they can still borrow. */
export interface MyLoansView {
  loans: LoanRow[];
  /** Savings balance minus outstanding active loan principal. */
  availableToBorrow: number;
}

export interface LoanFilters {
  status?: LoanStatus;
  profileId?: string;
}

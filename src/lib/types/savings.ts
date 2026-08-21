import type {
  SavingsAccountModel,
  SavingsTransactionModel,
} from "@/generated/prisma/models";

// Re-export Prisma models under friendly app-layer names.
export type SavingsAccount = SavingsAccountModel;
export type SavingsTransaction = SavingsTransactionModel;

/** Ledger transaction kinds. Contributions are positive, withdrawals negative. */
export type SavingsTransactionType = "contribution" | "withdrawal" | "adjustment";

/** An employee's savings account flattened for a supervision table. */
export interface SavingsAccountRow {
  accountId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  /** Recurring amount pulled each payroll period while active. */
  contributionAmount: number;
  active: boolean;
  /** Running balance = sum of all ledger amounts. */
  balance: number;
  lastActivityAt: string | null;
  /** Full ledger for the account, newest first (for the admin history view). */
  transactions: SavingsTransactionRow[];
}

/** A single savings ledger entry flattened for display. */
export interface SavingsTransactionRow {
  id: string;
  type: SavingsTransactionType;
  amount: number;
  note: string | null;
  appliedPeriodLabel: string | null;
  createdAt: string;
}

/** The self-service view: an employee's account plus its ledger. */
export interface EmployeeSavings {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  contributionAmount: number;
  active: boolean;
  balance: number;
  transactions: SavingsTransactionRow[];
}

-- Add `completed` status to ChargeStatus, IncentiveStatus, and CashAdvanceStatus enums.
-- This terminal state is set when the payroll run is approved, mirroring the
-- LoanStatus.completed pattern.

ALTER TYPE "ChargeStatus" ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE "IncentiveStatus" ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE "CashAdvanceStatus" ADD VALUE IF NOT EXISTS 'completed';

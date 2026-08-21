/**
 * Typed domain errors. Services throw these instead of returning null so callers
 * (server actions) can translate them into user-facing messages predictably.
 */

export class PayrollError extends Error {
  /** Stable machine-readable code for the error class. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class UnauthorizedError extends PayrollError {
  constructor(message = "You are not authorized to perform this action.") {
    super("UNAUTHORIZED", message);
  }
}

export class NotFoundError extends PayrollError {
  constructor(entity: string, id?: string) {
    super("NOT_FOUND", id ? `${entity} not found: ${id}` : `${entity} not found.`);
  }
}

export class PayrollAlreadyApprovedError extends PayrollError {
  constructor(periodId: string) {
    super(
      "PAYROLL_ALREADY_APPROVED",
      `Payroll period ${periodId} is already approved and can no longer be recalculated.`,
    );
  }
}

/** One of the statutory bracket tables has no row effective for the period. */
export class MissingStatutoryDataError extends PayrollError {
  readonly table: string;

  constructor(table: string, effectiveOnOrBefore: Date) {
    super(
      "MISSING_STATUTORY_DATA",
      `No ${table} rates effective on or before ${effectiveOnOrBefore
        .toISOString()
        .slice(0, 10)}. Seed the statutory tables before running payroll.`,
    );
    this.table = table;
  }
}

export class DuplicatePeriodError extends PayrollError {
  constructor(message = "A payroll period already overlaps this date range.") {
    super("DUPLICATE_PERIOD", message);
  }
}

export class InvalidStateTransitionError extends PayrollError {
  constructor(message: string) {
    super("INVALID_STATE_TRANSITION", message);
  }
}

/** A request that is well-formed but breaks a business rule (e.g. overdraw). */
export class BadRequestError extends PayrollError {
  constructor(message: string) {
    super("BAD_REQUEST", message);
  }
}

/** Narrow an unknown caught value to a user-safe message. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof PayrollError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

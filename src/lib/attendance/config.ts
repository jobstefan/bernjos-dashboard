/**
 * Attendance comparison tunables. Kept here (not in the DB) for now so the rules
 * are versioned with the code; can later move onto `Branch` or a settings table
 * if branches need different policies.
 */

/** Minutes an employee may clock in past their shift start before counting late. */
export const GRACE_MINUTES = 5;

/** Minutes late before a deduction is charged. At grace+1 min, the full lateMinutes are deducted. */
export const LATE_DEDUCTION_GRACE_MINUTES = 5;

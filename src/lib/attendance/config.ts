/**
 * Attendance comparison tunables. Kept here (not in the DB) for now so the rules
 * are versioned with the code; can later move onto `Branch` or a settings table
 * if branches need different policies.
 */

/** Minutes an employee may clock in past their shift start before counting late. */
export const GRACE_MINUTES = 15;

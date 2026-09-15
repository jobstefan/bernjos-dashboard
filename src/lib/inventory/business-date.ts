/**
 * Resolve which operating-day session a timestamp belongs to (§5.1).
 *
 * A branch's operating day runs until its configured `closingTime`, not
 * midnight. For a bakery that closes in the small hours (e.g. "02:00"), entries
 * logged after midnight but before that close still belong to the *previous*
 * calendar day's session. Branches that close before midnight should leave
 * `closingTime` null — then the boundary is plain midnight.
 *
 * Returns a date-only `Date` at UTC midnight so it matches the `@db.Date`
 * storage of `InventorySession.sessionDate`.
 */
export function businessDateFor(now: Date, closingTime: string | null): Date {
  const d = new Date(now);
  if (closingTime) {
    const [h, m] = closingTime.split(":").map(Number);
    const minutesNow = d.getHours() * 60 + d.getMinutes();
    const closeMinutes = h * 60 + m;
    // Before the (early-morning) close → still yesterday's operating day.
    if (minutesNow < closeMinutes) {
      d.setDate(d.getDate() - 1);
    }
  }
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

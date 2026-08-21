import type { ScheduleRow } from "@/lib/types/schedule";

/** Format an `HH:MM` 24-hour string as `8:00 AM`. */
export function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr.padStart(2, "0")} ${period}`;
}

/** Format a `YYYY-MM-DD` string as `Fri, Aug 22, 2026` (UTC-safe). */
export function formatScheduleDate(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  return d.toLocaleDateString("en-PH", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const NO_BRANCH = "Unassigned";

/**
 * Build a messaging-app-friendly schedule for a day, grouped by branch with the
 * day-off employees collected at the end. Ready to paste into Viber/WhatsApp.
 */
export function buildScheduleText(dateIso: string, rows: ScheduleRow[]): string {
  const lines: string[] = [`📅 Schedule — ${formatScheduleDate(dateIso)}`];

  const working = rows.filter((r) => !r.isDayOff);
  const groups = new Map<string, ScheduleRow[]>();
  for (const row of working) {
    const key = row.branchName ?? NO_BRANCH;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const branchNames = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  for (const branch of branchNames) {
    lines.push("", `📍 ${branch}`);
    for (const row of groups.get(branch) ?? []) {
      const times =
        row.startTime && row.endTime
          ? `${formatTime12h(row.startTime)} – ${formatTime12h(row.endTime)}`
          : "";
      const note = row.note ? ` (${row.note})` : "";
      lines.push(`• ${row.employeeName} — ${times}${note}`);
    }
  }

  const dayOff = rows.filter((r) => r.isDayOff);
  if (dayOff.length > 0) {
    lines.push(
      "",
      `😴 Day off: ${dayOff.map((r) => r.employeeName).join(", ")}`,
    );
  }

  return lines.join("\n");
}

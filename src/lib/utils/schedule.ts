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

/**
 * Fixed palette of accent classes for department color-coding. Kept as literal,
 * complete class strings so Tailwind's compiler picks them up. Each entry pairs a
 * dot background with a subtle row tint.
 */
const DEPARTMENT_ACCENTS = [
  { dot: "bg-blue-500", tint: "bg-blue-500/5" },
  { dot: "bg-emerald-500", tint: "bg-emerald-500/5" },
  { dot: "bg-amber-500", tint: "bg-amber-500/5" },
  { dot: "bg-violet-500", tint: "bg-violet-500/5" },
  { dot: "bg-rose-500", tint: "bg-rose-500/5" },
  { dot: "bg-cyan-500", tint: "bg-cyan-500/5" },
  { dot: "bg-orange-500", tint: "bg-orange-500/5" },
  { dot: "bg-lime-500", tint: "bg-lime-500/5" },
  { dot: "bg-pink-500", tint: "bg-pink-500/5" },
  { dot: "bg-indigo-500", tint: "bg-indigo-500/5" },
] as const;

const NEUTRAL_ACCENT = {
  dot: "bg-muted-foreground/40",
  tint: "",
} as const;

/**
 * Deterministically map a department name to a color accent, so the same
 * department always gets the same color across renders. Empty/unknown → neutral.
 */
export function departmentAccent(department: string): {
  dot: string;
  tint: string;
} {
  if (!department) return NEUTRAL_ACCENT;
  let hash = 0;
  for (let i = 0; i < department.length; i++) {
    hash = (hash * 31 + department.charCodeAt(i)) >>> 0;
  }
  return DEPARTMENT_ACCENTS[hash % DEPARTMENT_ACCENTS.length];
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
    const branchRows = (groups.get(branch) ?? []).slice().sort((a, b) => {
      const ta = a.startTime ?? "";
      const tb = b.startTime ?? "";
      if (ta && tb) return ta.localeCompare(tb);
      if (ta) return -1;
      if (tb) return 1;
      return a.employeeName.localeCompare(b.employeeName);
    });
    for (const row of branchRows) {
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

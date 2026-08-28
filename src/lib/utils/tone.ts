export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** Returns dual light+dark Tailwind pill classes for a semantic tone. */
export function toneClass(tone: Tone): string {
  switch (tone) {
    case "success":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
    case "danger":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300";
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300";
    case "neutral":
    default:
      return "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-400";
  }
}

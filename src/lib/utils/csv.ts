/** RFC-4180 cell escaping: wrap in quotes if the value contains , " or newline. */
function escapeCell(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

/**
 * Build a UTF-8 BOM + RFC-4180 CSV string and trigger a browser download.
 * Call this with the currently-visible (filtered) rows so export honours the toolbar.
 */
export function exportToCsv<T>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[],
): void {
  const headerRow = columns.map((c) => escapeCell(c.header)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((c) => escapeCell(c.accessor(row))).join(","),
  );
  const csv = [headerRow, ...dataRows].join("\r\n");

  // UTF-8 BOM so Excel / Numbers reads ₱ correctly
  const bom = "﻿";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

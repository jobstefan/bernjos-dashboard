import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole, canManageInventory } from "@/lib/auth/rbac";
import {
  getSessionForCorrection,
  listClosedSessions,
} from "@/server/services/inventory-corrections.service";
import { CorrectionsEditor } from "@/components/inventory/corrections-editor";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const role = await getCurrentRole();
  if (!canManageInventory(role)) redirect("/");

  const sp = await searchParams;
  const sessions = await listClosedSessions();
  const selectedId = sp.session ?? sessions[0]?.id ?? null;
  const detail = selectedId ? await getSessionForCorrection(selectedId) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Session Corrections</h1>
        <p className="text-sm text-muted-foreground">
          Adjust counts on closed sessions. Every change is recorded with its prior value; derived
          figures recompute automatically.
        </p>
      </div>


      {sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No closed sessions yet.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-1">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/inventory/corrections?session=${s.id}`}
                className={cn(
                  "block rounded-lg border px-3 py-2 text-sm transition-colors",
                  s.id === selectedId
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="font-medium">{s.branchName}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(s.sessionDate)}</div>
              </Link>
            ))}
          </aside>

          <div>{detail ? <CorrectionsEditor entries={detail.entries} /> : null}</div>
        </div>
      )}
    </div>
  );
}

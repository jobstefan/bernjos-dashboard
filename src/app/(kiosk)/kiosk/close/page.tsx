import { redirect } from "next/navigation";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { getKioskBranchId } from "@/lib/kiosk/branch-cookie";
import { getKioskState } from "@/server/services/inventory.service";
import { CloseSessionPage } from "@/components/kiosk/close-session-page";

export const dynamic = "force-dynamic";

export default async function KioskClosePage() {
  const branchId = await getKioskBranchId();
  if (!branchId) redirect("/kiosk");

  let state;
  try {
    state = await getKioskState(branchId);
  } catch {
    redirect("/kiosk");
  }

  // No open session — nothing to close.
  if (!state.session || state.session.closed) redirect("/kiosk");

  const dateLabel = new Date(state.session.sessionDate).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <CloseSessionPage
      sessionId={state.session.id}
      products={state.products}
      branchName={state.branch.name}
      dateLabel={dateLabel}
      devAuth={isDevAuthEnabled()}
    />
  );
}

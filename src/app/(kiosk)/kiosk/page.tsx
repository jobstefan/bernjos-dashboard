import { getCurrentRole, canManageInventory } from "@/lib/auth/rbac";
import { getKioskBranchId } from "@/lib/kiosk/branch-cookie";
import { getBranches } from "@/server/services/branch.service";
import { getKioskState } from "@/server/services/inventory.service";
import { listReleasableForBranch } from "@/server/services/inventory-release.service";
import { getTransfersForBranch } from "@/server/services/stock-transfer.service";
import { BranchPicker } from "@/components/kiosk/branch-picker";
import { KioskShell } from "@/components/kiosk/kiosk-shell";

// The kiosk is highly stateful (live on-hand); never cache it.
export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const role = await getCurrentRole();
  const branchId = await getKioskBranchId();

  if (!branchId) {
    const branches = await getBranches();
    return (
      <BranchPicker
        branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
      />
    );
  }

  // A stale cookie (branch deleted) falls back to the picker.
  let state;
  let releasable;
  let transfers;
  let allBranches;
  try {
    [state, releasable, transfers, allBranches] = await Promise.all([
      getKioskState(branchId),
      listReleasableForBranch(branchId),
      getTransfersForBranch(branchId),
      getBranches(),
    ]);
  } catch {
    const branches = await getBranches();
    return (
      <BranchPicker
        branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
      />
    );
  }

  // Other branches (for the "request stock from" picker) — exclude this one.
  const otherBranches = allBranches
    .filter((b) => b.id !== branchId)
    .map((b) => ({ id: b.id, name: b.name }));

  return (
    <KioskShell
      state={state}
      releasable={releasable}
      transfers={transfers}
      branches={otherBranches}
      canRepin={canManageInventory(role)}
    />
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SavingsLedger } from "@/components/savings/savings-ledger";
import { formatPeso } from "@/lib/utils/payroll";
import type { EmployeeSavings } from "@/lib/types/savings";

/** Read-only savings view for an employee: balance summary + ledger. */
export function MySavings({ savings }: { savings: EmployeeSavings }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-2xl font-bold text-primary">
              {formatPeso(savings.balance)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Per pay period
            </CardTitle>
            {savings.frozen ? <Badge variant="secondary">Frozen</Badge> : null}
          </CardHeader>
          <CardContent>
            <span className="font-mono text-2xl font-bold">
              {formatPeso(savings.contributionAmount)}
            </span>
          </CardContent>
        </Card>
      </div>

      <SavingsLedger transactions={savings.transactions} />
    </div>
  );
}

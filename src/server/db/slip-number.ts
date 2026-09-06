import "server-only";
import { prisma } from "@/lib/db";

async function nextSeq(sequence: "cash_advance_slip_seq" | "loan_slip_seq"): Promise<bigint> {
  const result = await prisma.$queryRawUnsafe<[{ nextval: bigint }]>(
    `SELECT nextval('${sequence}')`,
  );
  return result[0].nextval;
}

export async function nextCashAdvanceSlipNumber(branchCode: string | null): Promise<string> {
  const seq = await nextSeq("cash_advance_slip_seq");
  const code = branchCode ?? "UNK";
  return `CA-${code}-${seq.toString().padStart(6, "0")}`;
}

export async function nextLoanSlipNumber(branchCode: string | null): Promise<string> {
  const seq = await nextSeq("loan_slip_seq");
  const code = branchCode ?? "UNK";
  return `LN-${code}-${seq.toString().padStart(6, "0")}`;
}

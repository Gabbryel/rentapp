import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { readJson } from "@/lib/local-store";
import type { Deposit } from "@/lib/schemas/deposit";

type DepositRecord = Deposit & {
  assetId?: string | null;
  amountEUR?: number | null;
  amountRON?: number | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const contractId = url.searchParams.get("contractId");
  const assetId = url.searchParams.get("assetId");

  if (!contractId && !assetId) {
    return NextResponse.json({ error: "contractId or assetId required" }, { status: 400 });
  }

  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const match: Partial<Record<"contractId" | "assetId", string>> = {};
    if (contractId) match.contractId = contractId;
    if (assetId) match.assetId = assetId; // assumes deposits store assetId if needed
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          deposited: { $sum: { $cond: ['$isDeposited', 1, 0] } },
          sumDeposited: { $sum: { $cond: ['$isDeposited', '$amountEUR', 0] } },
          sumPending: { $sum: { $cond: ['$isDeposited', 0, '$amountEUR'] } },
          sumDepositedRON: { $sum: { $cond: ['$isDeposited', '$amountRON', 0] } },
          sumPendingRON: { $sum: { $cond: ['$isDeposited', 0, '$amountRON'] } },
        },
      },
    ];
    const res = await db.collection("deposits").aggregate(pipeline).toArray();
    const out =
      res[0] ??
      {
        total: 0,
        deposited: 0,
        sumDeposited: 0,
        sumPending: 0,
        sumDepositedRON: 0,
        sumPendingRON: 0,
      };
    return NextResponse.json(out);
  }

  try {
    const all = await readJson<DepositRecord[]>("deposits.json", []);
    const rows = all.filter(
      (deposit) =>
        (contractId ? deposit.contractId === contractId : true) &&
        (assetId ? deposit.assetId === assetId : true)
    );
    const total = rows.length;
    const deposited = rows.filter((row) => row.isDeposited).length;
    const sumDeposited = rows
      .filter((row) => row.isDeposited)
      .reduce((sum, row) => sum + (typeof row.amountEUR === "number" ? row.amountEUR : 0), 0);
    const sumPending = rows
      .filter((row) => !row.isDeposited)
      .reduce((sum, row) => sum + (typeof row.amountEUR === "number" ? row.amountEUR : 0), 0);
    const sumDepositedRON = rows
      .filter((row) => row.isDeposited)
      .reduce((sum, row) => sum + (typeof row.amountRON === "number" ? row.amountRON : 0), 0);
    const sumPendingRON = rows
      .filter((row) => !row.isDeposited)
      .reduce((sum, row) => sum + (typeof row.amountRON === "number" ? row.amountRON : 0), 0);
    return NextResponse.json({ total, deposited, sumDeposited, sumPending, sumDepositedRON, sumPendingRON });
  } catch (_error: unknown) {
    return NextResponse.json(
      { total: 0, deposited: 0, sumDeposited: 0, sumPending: 0, sumDepositedRON: 0, sumPendingRON: 0 },
      { status: 500 }
    );
  }
}

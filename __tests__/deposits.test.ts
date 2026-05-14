import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import {
  createDeposit,
  listDepositsForContract,
  updateDeposit,
  deleteDepositById,
  toggleDepositDeposited,
} from "@/lib/deposits";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "deposits.json");

async function cleanup() {
  try {
    await fs.unlink(file);
  } catch {}
}

describe("deposits", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("creates deposits and lists them", async () => {
    const d1 = await createDeposit({
      contractId: "C1",
      type: "bank_transfer",
      isDeposited: false,
      amountEUR: 100,
    });
    expect(d1.id).toBeTruthy();

    await createDeposit({
      contractId: "C1",
      type: "check",
      isDeposited: false,
      amountEUR: 50,
    });

    const list = await listDepositsForContract("C1");
    expect(list).toHaveLength(2);
  });

  it("toggles isDeposited", async () => {
    const d1 = await createDeposit({
      contractId: "C1",
      type: "bank_transfer",
      isDeposited: false,
      amountEUR: 100,
    });

    const ok = await toggleDepositDeposited(d1.id);
    expect(ok).toBe(true);

    const after = await listDepositsForContract("C1");
    const toggled = after.find((x) => x.id === d1.id);
    expect(toggled?.isDeposited).toBe(true);
  });

  it("updates a deposit", async () => {
    const d = await createDeposit({
      contractId: "C1",
      type: "check",
      isDeposited: false,
      amountEUR: 50,
    });

    const updated = await updateDeposit({ ...d, note: "Updated note" });
    expect(updated.note).toBe("Updated note");
  });

  it("deletes a deposit", async () => {
    const d1 = await createDeposit({
      contractId: "C1",
      type: "bank_transfer",
      isDeposited: false,
      amountEUR: 100,
    });
    await createDeposit({
      contractId: "C1",
      type: "check",
      isDeposited: false,
      amountEUR: 50,
    });

    const deleted = await deleteDepositById(d1.id);
    expect(deleted).toBe(true);

    const final = await listDepositsForContract("C1");
    expect(final).toHaveLength(1);
  });
});

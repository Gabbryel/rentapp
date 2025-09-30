// Deprecated: Raiffeisen exchange rate utilities have been removed.
// This module is kept as a stub to avoid import errors and will throw if used.

export async function getDailyRaiEurSell(): Promise<never> {
  throw new Error("Raiffeisen rate removed: use BNR (/lib/exchange.ts) or BT (/lib/exchange-bt.ts) instead.");
}

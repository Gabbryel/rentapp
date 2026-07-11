// Convert a VAT-included (gross) amount to the net amount stored on contracts.
// Rounded to 2 decimals. A missing/zero TVA percent leaves the amount unchanged.
export function netFromGross(
  gross: number,
  tvaPercent: number | undefined,
): number {
  const pct =
    typeof tvaPercent === "number" && Number.isFinite(tvaPercent) && tvaPercent > 0
      ? tvaPercent
      : 0;
  return Math.round((gross / (1 + pct / 100)) * 100) / 100;
}

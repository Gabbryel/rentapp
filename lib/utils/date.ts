/**
 * Date utility functions
 */

/**
 * Normalizes a date value to ISO format (YYYY-MM-DD)
 * @param value - The date value to normalize
 * @returns ISO date string or null if invalid
 */
export function normalizeIsoDate(value: unknown): string | null {
  const s = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

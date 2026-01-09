/**
 * HTML utility functions
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param input - The input to escape (will be converted to string)
 * @returns HTML-safe string
 */
export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

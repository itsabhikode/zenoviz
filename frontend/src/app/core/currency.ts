/**
 * Nepalese Rupee (NPR) display for the app (Nepal deployment).
 */
export const NPR_PREFIX = 'Rs.';

/**
 * Formats a numeric amount for display with Nepali locale grouping.
 */
export function formatNprAmount(
  value: string | number,
  options?: { maxFractionDigits?: number; minFractionDigits?: number },
): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return String(value);
  const maxF = options?.maxFractionDigits ?? 0;
  const minF = options?.minFractionDigits ?? 0;
  if (maxF > 0 || minF > 0) {
    return n.toLocaleString('en-NP', {
      minimumFractionDigits: minF,
      maximumFractionDigits: maxF,
    });
  }
  return Math.round(n).toLocaleString('en-NP');
}

/** Full money string for inline text, e.g. snack messages. */
export function nprText(
  value: string | number,
  options?: { maxFractionDigits?: number; minFractionDigits?: number },
): string {
  return `${NPR_PREFIX} ${formatNprAmount(value, options)}`;
}

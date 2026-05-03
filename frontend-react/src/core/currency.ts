export const NPR_PREFIX = 'Rs.'

export function formatNprAmount(
  value: string | number,
  options?: { maxFractionDigits?: number; minFractionDigits?: number },
): string {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return String(value)
  const minF = options?.minFractionDigits ?? 0
  const maxF = options?.maxFractionDigits ?? minF
  if (maxF > 0 || minF > 0) {
    return n.toLocaleString('en-NP', {
      minimumFractionDigits: minF,
      maximumFractionDigits: Math.max(maxF, minF),
    })
  }
  return Math.round(n).toLocaleString('en-NP')
}

export function nprText(
  value: string | number,
  options?: { maxFractionDigits?: number; minFractionDigits?: number },
): string {
  return `${NPR_PREFIX} ${formatNprAmount(value, options)}`
}

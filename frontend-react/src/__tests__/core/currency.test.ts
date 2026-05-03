import { describe, it, expect } from 'vitest'
import { NPR_PREFIX, formatNprAmount, nprText } from '@/core/currency'

describe('NPR_PREFIX', () => {
  it('is "Rs."', () => {
    expect(NPR_PREFIX).toBe('Rs.')
  })
})

describe('formatNprAmount', () => {
  it('formats an integer number', () => {
    expect(formatNprAmount(1000)).toBe('1,000')
  })

  it('formats a numeric string', () => {
    expect(formatNprAmount('500')).toBe('500')
  })

  it('rounds a float when no fraction options given', () => {
    expect(formatNprAmount(99.6)).toBe('100')
  })

  it('formats with maxFractionDigits', () => {
    const result = formatNprAmount(1234.5, { maxFractionDigits: 2 })
    expect(result).toBe('1,234.5')
  })

  it('formats with minFractionDigits', () => {
    const result = formatNprAmount(100, { minFractionDigits: 2 })
    expect(result).toBe('100.00')
  })

  it('returns string value unchanged for NaN string', () => {
    expect(formatNprAmount('abc')).toBe('abc')
  })

  it('returns string value unchanged for NaN number', () => {
    expect(formatNprAmount(NaN)).toBe('NaN')
  })
})

describe('nprText', () => {
  it('prepends NPR_PREFIX with space', () => {
    expect(nprText(500)).toBe('Rs. 500')
  })

  it('works with string values', () => {
    expect(nprText('2000')).toBe('Rs. 2,000')
  })

  it('works with fraction options', () => {
    const result = nprText(1500.75, { maxFractionDigits: 2, minFractionDigits: 2 })
    expect(result).toBe('Rs. 1,500.75')
  })
})

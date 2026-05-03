import { describe, it, expect } from 'vitest'

describe('test setup', () => {
  it('runs vitest with jsdom', () => {
    expect(document).toBeDefined()
  })
})

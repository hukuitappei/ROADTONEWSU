import { isPdfWithinQaLimit, PHASE1_PDF_PAGE_LIMIT, PHASE1_PDF_CHAR_LIMIT } from '@/lib/pdf'

describe('isPdfWithinQaLimit', () => {
  it('returns true when both values are within limits', () => {
    expect(isPdfWithinQaLimit(10, 40000)).toBe(true)
  })

  it('returns true at exact limits', () => {
    expect(isPdfWithinQaLimit(PHASE1_PDF_PAGE_LIMIT, PHASE1_PDF_CHAR_LIMIT)).toBe(true)
  })

  it('returns false when page count exceeds limit', () => {
    expect(isPdfWithinQaLimit(PHASE1_PDF_PAGE_LIMIT + 1, 40000)).toBe(false)
  })

  it('returns false when char count exceeds limit', () => {
    expect(isPdfWithinQaLimit(10, PHASE1_PDF_CHAR_LIMIT + 1)).toBe(false)
  })

  it('returns false when both limits are exceeded', () => {
    expect(isPdfWithinQaLimit(PHASE1_PDF_PAGE_LIMIT + 1, PHASE1_PDF_CHAR_LIMIT + 1)).toBe(false)
  })

  it('returns false for zero pages', () => {
    expect(isPdfWithinQaLimit(0, 0)).toBe(true)
  })
})

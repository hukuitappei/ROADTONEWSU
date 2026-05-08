import { extractPdfText, isPdfWithinQaLimit, PHASE1_PDF_CHAR_LIMIT, PHASE1_PDF_PAGE_LIMIT } from '@/lib/pdf'

describe('pdf helpers', () => {
  test('extractPdfText uses mock parser', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'x.pdf', { type: 'application/pdf' })
    const data = await extractPdfText(file)
    expect(data.text).toBe('mocked pdf text')
    expect(data.pageCount).toBe(2)
  })

  test('within limits true at boundary', () => {
    expect(isPdfWithinQaLimit(PHASE1_PDF_PAGE_LIMIT, PHASE1_PDF_CHAR_LIMIT)).toBe(true)
  })
  test('false when page exceeds', () => expect(isPdfWithinQaLimit(PHASE1_PDF_PAGE_LIMIT + 1, 10)).toBe(false))
  test('false when chars exceed', () => expect(isPdfWithinQaLimit(1, PHASE1_PDF_CHAR_LIMIT + 1)).toBe(false))
  test('true for small values', () => expect(isPdfWithinQaLimit(1, 10)).toBe(true))
  test('false when both exceed', () => expect(isPdfWithinQaLimit(PHASE1_PDF_PAGE_LIMIT + 1, PHASE1_PDF_CHAR_LIMIT + 1)).toBe(false))
  test('true for zero zero', () => expect(isPdfWithinQaLimit(0, 0)).toBe(true))
  test('true max page lower char', () => expect(isPdfWithinQaLimit(PHASE1_PDF_PAGE_LIMIT, 1)).toBe(true))
  test('true max char lower page', () => expect(isPdfWithinQaLimit(1, PHASE1_PDF_CHAR_LIMIT)).toBe(true))
})

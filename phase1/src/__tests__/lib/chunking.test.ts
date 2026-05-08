import { chunkText, headSummaryChunks, PHASE1_SUMMARY_CHUNK_LIMIT } from '@/lib/chunking'

describe('chunkText', () => {
  it('returns empty array for empty string', () => {
    expect(chunkText('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(chunkText('   ')).toEqual([])
  })

  it('returns single chunk when text fits within chunkSize', () => {
    const result = chunkText('hello world')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ index: 0, content: 'hello world' })
  })

  it('splits text into multiple chunks with correct indices', () => {
    const text = 'a'.repeat(7000)
    const result = chunkText(text, 3000)
    expect(result).toHaveLength(3)
    expect(result.map((c) => c.index)).toEqual([0, 1, 2])
    expect(result[0].content).toHaveLength(3000)
    expect(result[1].content).toHaveLength(3000)
    expect(result[2].content).toHaveLength(1000)
  })

  it('trims leading and trailing whitespace before chunking', () => {
    const result = chunkText('  hello  ')
    expect(result[0].content).toBe('hello')
  })

  it('respects custom chunkSize', () => {
    const result = chunkText('abcde', 2)
    expect(result).toHaveLength(3)
    expect(result[0].content).toBe('ab')
    expect(result[1].content).toBe('cd')
    expect(result[2].content).toBe('e')
  })
})

describe('headSummaryChunks', () => {
  const chunks = Array.from({ length: 8 }, (_, i) => ({ index: i, content: `chunk${i}` }))

  it('returns first PHASE1_SUMMARY_CHUNK_LIMIT chunks by default', () => {
    const result = headSummaryChunks(chunks)
    expect(result).toHaveLength(PHASE1_SUMMARY_CHUNK_LIMIT)
    expect(result[0].content).toBe('chunk0')
    expect(result[PHASE1_SUMMARY_CHUNK_LIMIT - 1].content).toBe(`chunk${PHASE1_SUMMARY_CHUNK_LIMIT - 1}`)
  })

  it('returns all chunks when count exceeds length', () => {
    expect(headSummaryChunks(chunks, 100)).toHaveLength(8)
  })

  it('respects custom count', () => {
    expect(headSummaryChunks(chunks, 2)).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(headSummaryChunks([])).toHaveLength(0)
  })
})

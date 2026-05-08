import { chunkText, headSummaryChunks } from '@/lib/chunking'

describe('chunking', () => {
  test('returns empty for blank', () => expect(chunkText('   ')).toEqual([]))
  test('single chunk small text', () => expect(chunkText('abc', 10)).toHaveLength(1))
  test('splits exact size', () => expect(chunkText('a'.repeat(6), 3)).toHaveLength(2))
  test('splits remainder', () => expect(chunkText('a'.repeat(7), 3)).toHaveLength(3))
  test('keeps index sequence', () => expect(chunkText('abcdef', 2).map((v) => v.index)).toEqual([0, 1, 2]))
  test('trims edges', () => expect(chunkText('  abc  ', 10)[0].content).toBe('abc'))
  test('headSummaryChunks default 5', () => expect(headSummaryChunks(chunkText('a'.repeat(40), 5))).toHaveLength(5))
  test('headSummaryChunks custom count', () => expect(headSummaryChunks(chunkText('a'.repeat(40), 5), 2)).toHaveLength(2))
  test('headSummaryChunks returns all when short', () => expect(headSummaryChunks(chunkText('abc', 2), 5)).toHaveLength(2))
})

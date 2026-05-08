export const PHASE1_SUMMARY_CHUNK_LIMIT = 5

export type TextChunk = {
  index: number
  content: string
  startPage: number | null
  endPage: number | null
}

type PageBoundary = {
  pageNumber: number
  start: number
  end: number
}

const DEFAULT_CHUNK_SIZE = 3000

const findPageForOffset = (pages: PageBoundary[], offset: number) => {
  const page = pages.find((p) => offset >= p.start && offset < p.end)
  return page?.pageNumber ?? null
}

export const chunkText = (text: string, chunkSize = DEFAULT_CHUNK_SIZE, pages: PageBoundary[] = []): TextChunk[] => {
  const normalized = text.trim()
  if (!normalized) return []

  const sourceStart = text.indexOf(normalized)

  const chunks: TextChunk[] = []
  for (let start = 0, index = 0; start < normalized.length; start += chunkSize, index += 1) {
    const chunkStart = sourceStart + start
    const chunkEndExclusive = Math.min(sourceStart + start + chunkSize, sourceStart + normalized.length)
    const startPage = findPageForOffset(pages, chunkStart)
    const endPage = findPageForOffset(pages, Math.max(chunkStart, chunkEndExclusive - 1))
    chunks.push({
      index,
      content: normalized.slice(start, start + chunkSize),
      startPage,
      endPage,
    })
  }

  return chunks
}

export const headSummaryChunks = (chunks: TextChunk[], count = PHASE1_SUMMARY_CHUNK_LIMIT) => chunks.slice(0, count)

export const PHASE1_SUMMARY_CHUNK_LIMIT = 5

export type TextChunk = {
  index: number
  content: string
}

const DEFAULT_CHUNK_SIZE = 3000

export const chunkText = (text: string, chunkSize = DEFAULT_CHUNK_SIZE): TextChunk[] => {
  const normalized = text.trim()
  if (!normalized) return []

  const chunks: TextChunk[] = []
  for (let start = 0, index = 0; start < normalized.length; start += chunkSize, index += 1) {
    chunks.push({
      index,
      content: normalized.slice(start, start + chunkSize),
    })
  }

  return chunks
}

export const headSummaryChunks = (chunks: TextChunk[], count = PHASE1_SUMMARY_CHUNK_LIMIT) => chunks.slice(0, count)

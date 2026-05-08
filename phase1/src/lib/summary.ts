import { chunkText, headSummaryChunks } from '@/lib/chunking'
import { isPdfWithinQaLimit, PHASE1_QA_LIMIT_MESSAGE, extractPdfText } from '@/lib/pdf'
import { saveDocumentChunks, updateDocument } from '@/lib/repository'

const summarizeChunk = (text: string) => {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  return cleaned.slice(0, Math.min(240, cleaned.length))
}

export const enqueueDocumentProcessing = async (documentId: string, file: File) => {
  try {
    await updateDocument(documentId, { status: 'processing', error_message: null })
    const extracted = await extractPdfText(file)
    const charCount = extracted.text.length
    const qaEnabled = isPdfWithinQaLimit(extracted.pageCount, charCount)

    const allChunks = chunkText(extracted.text)
    await saveDocumentChunks(documentId, allChunks)
    const summaryChunks = headSummaryChunks(allChunks)
    const summaryBody = summaryChunks.map((chunk) => `- ${summarizeChunk(chunk.content)}`).join('\n')

    const summary = qaEnabled
      ? summaryBody || null
      : [PHASE1_QA_LIMIT_MESSAGE, '', summaryBody].filter(Boolean).join('\n')

    await updateDocument(documentId, {
      status: 'ready',
      qaEnabled,
      summary,
      page_count: extracted.pageCount,
      char_count: charCount,
      error_message: qaEnabled ? null : PHASE1_QA_LIMIT_MESSAGE,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'document processing failed'
    await updateDocument(documentId, { status: 'error', qaEnabled: false, error_message: message })
  }
}

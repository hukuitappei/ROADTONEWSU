export const PHASE1_PDF_PAGE_LIMIT = 30
export const PHASE1_PDF_CHAR_LIMIT = 80000

export const PHASE1_QA_LIMIT_MESSAGE = 'このPDFはPhase 1のQ&A上限を超えています。要約のみ対応します。'

export type ExtractedPdf = {
  text: string
  pageCount: number
}

export const extractPdfText = async (file: File): Promise<ExtractedPdf> => {
  const raw = await file.text()
  return {
    text: raw,
    pageCount: estimatePageCount(raw),
  }
}

const estimatePageCount = (text: string) => {
  const pageBreaks = text.match(/\f/g)?.length ?? 0
  return Math.max(1, pageBreaks + 1)
}

export const isPdfWithinQaLimit = (pageCount: number, charCount: number) =>
  pageCount <= PHASE1_PDF_PAGE_LIMIT && charCount <= PHASE1_PDF_CHAR_LIMIT
